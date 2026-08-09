import os
import sys
import time
from contextlib import contextmanager

import cv2
import numpy as np

# OpenCV MSMF + HW transforms often fails stream selection on Win10/11;
# disable unless the user already set the env (legacy C170 / Frame Server).
if sys.platform == "win32":
	os.environ.setdefault("OPENCV_VIDEOIO_MSMF_ENABLE_HW_TRANSFORMS", "0")

TARGET_FPS = 10
PROCESSING_RESOLUTION = (320, 240)

# Frames below this mean luma (0–255) are treated as black / unusable.
BLACK_LUMA_THRESHOLD = 12.0
WARMUP_READS = 12
WARMUP_MIN_GOOD = 2
# Runtime: reopen/failover after this many consecutive black seconds.
BLACK_STREAK_S = 2.0
# After open: if frames flow but no usable face, try the next backend (DSHOW↔MSMF).
NO_FACE_FAILOVER_S = 5.0
# Cap no-face failovers per process so an empty room does not spin forever.
MAX_NO_FACE_FAILOVERS = 2
HEALTH_INTERVAL_S = 3.0


def mean_luma(frame) -> float:
	"""Average brightness of a BGR/gray frame (0–255)."""
	if frame is None or getattr(frame, "size", 0) == 0:
		return 0.0
	if len(frame.shape) == 2:
		return float(np.mean(frame))
	# BGR: cheap luma approx without full cvtColor on every health sample.
	b, g, r = cv2.split(frame)
	return float(0.114 * np.mean(b) + 0.587 * np.mean(g) + 0.299 * np.mean(r))


def is_black_frame(frame, threshold=BLACK_LUMA_THRESHOLD) -> bool:
	return mean_luma(frame) < threshold


def backend_name(backend) -> str:
	names = {
		getattr(cv2, "CAP_DSHOW", -1): "DSHOW",
		getattr(cv2, "CAP_MSMF", -1): "MSMF",
		getattr(cv2, "CAP_AVFOUNDATION", -1): "AVFOUNDATION",
		getattr(cv2, "CAP_V4L2", -1): "V4L2",
		getattr(cv2, "CAP_ANY", -1): "ANY",
	}
	return names.get(backend, str(backend))


def fourcc_to_str(value) -> str:
	try:
		code = int(value)
	except (TypeError, ValueError):
		return ""
	if code <= 0:
		return ""
	chars = "".join(chr((code >> (8 * i)) & 0xFF) for i in range(4))
	return chars.strip("\x00") or ""


def is_mjpg_fourcc(code: str) -> bool:
	"""True for MJPG or endian-swapped GPJM from some CAP_PROP getters."""
	normalized = (code or "").upper().replace("\x00", "")
	return normalized in ("MJPG", "GPJM")


@contextmanager
def opencv_quiet_warnings():
	"""Drop OpenCV WARN spam (e.g. MSMF initStream) during probe/open."""
	getter = getattr(cv2, "getLogLevel", None)
	setter = getattr(cv2, "setLogLevel", None)
	if getter is None or setter is None:
		yield
		return
	previous = getter()
	try:
		setter(getattr(cv2, "LOG_LEVEL_ERROR", 2))
		yield
	finally:
		setter(previous)


class OpenCVCamera:
	def __init__(self, transport):
		self.transport = transport
		self.capture = None
		self.active = False
		self.target_fps = TARGET_FPS
		self.processing_resolution = PROCESSING_RESOLUTION
		self.camera_index = None
		self.backend = None
		self.fourcc = None
		# Last successful open — tried first on the next start.
		self._preferred_index = None
		self._preferred_backend = None
		self._failover_cursor = 0
		self._no_face_failovers = 0

	def emit_camera_state(self, kind, **fields):
		payload = {"kind": kind, **fields}
		# Dual-channel: structured cameraState for tooling + short debug for
		# support zips that only skim message text.
		self.transport.send(
			{
				"cameraState": payload,
				"debug": f"cameraState {kind}",
			}
		)

	def _platform_backends(self):
		if sys.platform == "win32":
			# Prefer DirectShow for older UVC cams (Logitech C170 etc.).
			# Windows Camera / Discord use Media Foundation Frame Server correctly;
			# OpenCV's MSMF path often negotiates poorly (black/no-face after
			# "Success"). MSMF remains the failover. Skip CAP_ANY (re-enters MSMF).
			return [cv2.CAP_DSHOW, cv2.CAP_MSMF]
		if sys.platform == "darwin":
			return [cv2.CAP_AVFOUNDATION, cv2.CAP_ANY]
		return [cv2.CAP_V4L2, cv2.CAP_ANY]

	def _candidate_pairs(self):
		"""Ordered (index, backend) attempts: preferred first, then scan.

		Index-major order: try camera 0 on every backend before probing 1–4.
		Cold start otherwise hammers empty indices before a working @0 pair.
		"""
		backends = self._platform_backends()
		pairs = []
		seen = set()

		def add(index, backend):
			key = (index, backend)
			if key in seen:
				return
			seen.add(key)
			pairs.append(key)

		if (
			self._preferred_index is not None
			and self._preferred_backend is not None
		):
			add(self._preferred_index, self._preferred_backend)

		for index in range(5):
			for backend in backends:
				add(index, backend)
		return pairs

	def _snap_open_resolution(self):
		"""Map processing preset to a size old UVC cams actually expose.

		Logitech C170-class devices often list 640x480 / 320x240 / 352x288 and
		odd modes like 640x360; asking for arbitrary High preset sizes makes
		Windows pick a weird native mode. Prefer classic 4:3 open sizes.
		"""
		width, height = self.processing_resolution
		candidates = (
			(640, 480),
			(320, 240),
			(352, 288),
			(160, 120),
		)
		# Prefer not upsizing beyond what the preset asked for.
		fitting = [c for c in candidates if c[0] <= width and c[1] <= height]
		if not fitting:
			return candidates[-1]
		# Largest fitting classic size.
		return max(fitting, key=lambda wh: wh[0] * wh[1])

	def _try_set_fourcc(self, cap, code: str) -> str:
		"""Best-effort FOURCC; return actual fourcc string after set."""
		try:
			cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*code))
		except Exception:
			pass
		return fourcc_to_str(cap.get(cv2.CAP_PROP_FOURCC))

	def _apply_capture_props(self, capture=None):
		cap = capture if capture is not None else self.capture
		if cap is None:
			return
		width, height = self._snap_open_resolution()
		fourcc_requested = None
		fourcc_actual = fourcc_to_str(cap.get(cv2.CAP_PROP_FOURCC))

		if sys.platform == "win32":
			# Win10+ Frame Server often hides raw MJPG and offers YUY2/NV12.
			# Soft-try MJPG; if unset, try YUY2; never clobber a negotiated
			# NV12/other format (Microsoft Camera Frame Server guidance).
			fourcc_requested = "MJPG"
			fourcc_actual = self._try_set_fourcc(cap, "MJPG")
			if not is_mjpg_fourcc(fourcc_actual) and not fourcc_actual:
				fourcc_actual = self._try_set_fourcc(cap, "YUY2")
				fourcc_requested = "YUY2"
		else:
			fourcc_requested = "MJPG"
			fourcc_actual = self._try_set_fourcc(cap, "MJPG")

		try:
			cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
		except Exception:
			pass

		cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
		cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
		# Do NOT set CAP_PROP_FPS on Windows — known to break format
		# negotiation for many UVC webcams (OpenCV #9084).
		if sys.platform != "win32":
			cap.set(cv2.CAP_PROP_FPS, self.target_fps)

		actual_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
		actual_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
		actual_fps = cap.get(cv2.CAP_PROP_FPS)
		actual_fourcc = fourcc_to_str(cap.get(cv2.CAP_PROP_FOURCC)) or fourcc_actual
		self.fourcc = actual_fourcc or self.fourcc
		self.emit_camera_state(
			"camera_props",
			requested_wh=[width, height],
			requested_fps=self.target_fps,
			requested_fourcc=fourcc_requested,
			actual_wh=[actual_width, actual_height],
			actual_fps=actual_fps,
			fourcc=actual_fourcc,
			backend=self.backend,
			backend_name=backend_name(self.backend)
			if self.backend is not None
			else None,
			index=self.camera_index,
			fps_prop_set=sys.platform != "win32",
		)
		self.transport.send(
			{
				"debug": (
					"Camera resolution set to: "
					f"{actual_width}x{actual_height}, FPS: {actual_fps}, "
					f"fourcc={actual_fourcc or '?'}"
				)
			}
		)

	def _warm_up(self, capture, index, backend):
		"""Discard early frames; require non-black samples before accepting."""
		good = 0
		last_luma = 0.0
		reject_reason = "read_fail"
		for i in range(WARMUP_READS):
			ret, frame = capture.read()
			if not ret or frame is None:
				reject_reason = "read_fail"
				continue
			last_luma = mean_luma(frame)
			if is_black_frame(frame):
				reject_reason = "black"
				continue
			good += 1
			reject_reason = None
			if good >= WARMUP_MIN_GOOD:
				return True, last_luma, i + 1, None
		return False, last_luma, WARMUP_READS, reject_reason or "black"

	def _try_open_pair(self, index, backend):
		name = backend_name(backend)
		self.emit_camera_state(
			"camera_open_attempt",
			index=index,
			backend=backend,
			backend_name=name,
			fourcc="MJPG",
			requested_wh=list(self.processing_resolution),
			requested_fps=self.target_fps,
		)
		self.transport.send(
			{
				"debug": (
					f"Trying camera index {index} with backend {backend} ({name})"
				)
			}
		)
		capture = None
		try:
			capture = cv2.VideoCapture(index, backend)
			if not capture.isOpened():
				self.emit_camera_state(
					"camera_open_result",
					ok=False,
					index=index,
					backend=backend,
					backend_name=name,
					reject_reason="not_opened",
				)
				capture.release()
				return None

			self.camera_index = index
			self.backend = backend
			self._apply_capture_props(capture)
			ok, luma, warm_frames, reject = self._warm_up(
				capture, index, backend
			)
			actual_wh = [
				capture.get(cv2.CAP_PROP_FRAME_WIDTH),
				capture.get(cv2.CAP_PROP_FRAME_HEIGHT),
			]
			actual_fps = capture.get(cv2.CAP_PROP_FPS)
			if not ok:
				self.emit_camera_state(
					"camera_open_result",
					ok=False,
					index=index,
					backend=backend,
					backend_name=name,
					actual_wh=actual_wh,
					actual_fps=actual_fps,
					mean_luma=luma,
					warm_frames=warm_frames,
					reject_reason=reject,
				)
				self.transport.send(
					{
						"debug": (
							f"Camera {index}/{name} rejected: {reject} "
							f"(luma={luma:.1f})"
						)
					}
				)
				capture.release()
				self.camera_index = None
				self.backend = None
				return None

			self.emit_camera_state(
				"camera_open_result",
				ok=True,
				index=index,
				backend=backend,
				backend_name=name,
				actual_wh=actual_wh,
				actual_fps=actual_fps,
				mean_luma=luma,
				warm_frames=warm_frames,
				fourcc=self.fourcc,
			)
			self.transport.send(
				{
					"debug": (
						f"Success! Camera {index} working with backend "
						f"{backend} ({name}), luma={luma:.1f}"
					)
				}
			)
			self.transport.send(
				{
					"status": (
						f"Found working camera at index {index}"
					)
				}
			)
			return capture
		except Exception as error:
			self.emit_camera_state(
				"camera_open_result",
				ok=False,
				index=index,
				backend=backend,
				backend_name=name,
				reject_reason=f"exception:{error}",
			)
			self.transport.send(
				{
					"debug": (
						f"Exception testing camera {index} "
						f"with backend {backend}: {str(error)}"
					)
				}
			)
			if capture is not None:
				try:
					capture.release()
				except Exception:
					pass
			self.camera_index = None
			self.backend = None
			return None

	def _release_capture(self):
		if self.capture is not None:
			try:
				self.capture.release()
			except Exception:
				pass
			self.capture = None

	def start(self, reset_detection):
		self.transport.send({"debug": "start_camera() called"})
		if self.active and self.capture is not None:
			self.transport.send({"debug": "Camera already active"})
			return True

		self._release_capture()
		self.active = False

		max_retries = 10
		retry_delay = 2
		with opencv_quiet_warnings():
			for attempt in range(max_retries):
				self.transport.send(
					{
						"debug": (
							f"Camera start attempt {attempt + 1}/{max_retries}"
						)
					}
				)
				self.transport.send({"debug": "Starting camera detection..."})
				opened = None
				for index, backend in self._candidate_pairs():
					opened = self._try_open_pair(index, backend)
					if opened is not None:
						break

				if opened is None:
					self.transport.send(
						{
							"debug": (
								"No working camera found on attempt "
								f"{attempt + 1}"
							)
						}
					)
					if attempt < max_retries - 1:
						time.sleep(retry_delay)
						continue
					self.transport.send(
						{"error": "No working camera found after all attempts"}
					)
					return False

				self.capture = opened
				self.active = True
				self._preferred_index = self.camera_index
				self._preferred_backend = self.backend
				self._failover_cursor = 0
				self.transport.send({"status": "Camera opened successfully"})
				reset_detection()
				return True

		return False

	def stop(self, reason="stop_camera"):
		self.transport.send({"debug": "stop_camera() called"})
		was_active = self.active
		self._release_capture()
		self.active = False
		if was_active or reason:
			self.emit_camera_state(
				"camera_stop",
				reason=reason,
				index=self.camera_index,
				backend=self.backend,
				backend_name=backend_name(self.backend)
				if self.backend is not None
				else None,
			)
		self.transport.send({"status": "Camera released"})

	def update_target_fps(self, target_fps):
		self.target_fps = int(target_fps)
		# Do not set CAP_PROP_FPS mid-stream — MSMF often goes black/stale.
		# FPS is applied on the next open via _apply_capture_props.

	def update_processing_resolution(self, processing_resolution):
		self.processing_resolution = tuple(processing_resolution)
		# Detector loop resizes to processing_resolution; avoid mid-stream
		# CAP_PROP size changes that break Windows MSMF after a "Success" open.

	def snapshot_meta(self):
		wh = None
		fps = None
		if self.capture is not None:
			wh = [
				self.capture.get(cv2.CAP_PROP_FRAME_WIDTH),
				self.capture.get(cv2.CAP_PROP_FRAME_HEIGHT),
			]
			fps = self.capture.get(cv2.CAP_PROP_FPS)
		return {
			"index": self.camera_index,
			"backend": self.backend,
			"backend_name": backend_name(self.backend)
			if self.backend is not None
			else None,
			"fourcc": self.fourcc,
			"capture_wh": wh,
			"capture_fps": fps,
			"processing_resolution": list(self.processing_resolution),
			"target_fps": self.target_fps,
		}

	def _failover_order(self):
		"""Next (index, backend) pairs after the current open.

		On Windows, prefer flipping MSMF↔DSHOW on the same index before
		scanning other indices — the common “opens but no face” case.
		"""
		pairs = self._candidate_pairs()
		current = (self.camera_index, self.backend)
		ordered = []
		seen = set()

		def add(pair):
			if pair in seen or pair not in pairs:
				return
			seen.add(pair)
			ordered.append(pair)

		if (
			sys.platform == "win32"
			and self.camera_index is not None
			and self.backend is not None
		):
			msmf = getattr(cv2, "CAP_MSMF", None)
			dshow = getattr(cv2, "CAP_DSHOW", None)
			if self.backend == msmf and dshow is not None:
				add((self.camera_index, dshow))
			elif self.backend == dshow and msmf is not None:
				add((self.camera_index, msmf))

		for pair in pairs:
			if pair != current:
				add(pair)
		return ordered

	def recover_from_black_frames(self, reset_detection, streak_ms, mean_luma_value):
		"""Reopen with next backend/index after a sustained black streak."""
		return self.failover_capture(
			reset_detection,
			reason="black_streak",
			streak_ms=streak_ms,
			mean_luma=mean_luma_value,
		)

	def recover_from_no_face(self, reset_detection, streak_ms):
		"""Reopen after sustained no-face despite non-black frames."""
		if self._no_face_failovers >= MAX_NO_FACE_FAILOVERS:
			self.transport.send(
				{
					"debug": (
						"No-face failover cap reached "
						f"({MAX_NO_FACE_FAILOVERS}); keeping current capture"
					)
				}
			)
			return False
		ok = self.failover_capture(
			reset_detection,
			reason="no_face",
			streak_ms=streak_ms,
		)
		if ok:
			self._no_face_failovers += 1
		return ok

	def failover_capture(self, reset_detection, reason, **extra):
		"""Release current capture and try the next backend/index."""
		from_meta = self.snapshot_meta()
		self.emit_camera_state(
			"camera_failover_begin",
			reason=reason,
			action="failover",
			**extra,
			**{k: from_meta[k] for k in ("index", "backend", "backend_name")},
		)
		ordered = self._failover_order()
		self._release_capture()
		self.active = False

		with opencv_quiet_warnings():
			for index, backend in ordered:
				opened = self._try_open_pair(index, backend)
				if opened is None:
					continue
				to_name = backend_name(backend)
				self.emit_camera_state(
					"camera_failover",
					from_index=from_meta.get("index"),
					from_backend=from_meta.get("backend"),
					from_backend_name=from_meta.get("backend_name"),
					to_index=index,
					to_backend=backend,
					to_backend_name=to_name,
					reason=reason,
				)
				self.capture = opened
				self.active = True
				self._preferred_index = index
				self._preferred_backend = backend
				reset_detection()
				self.transport.send({"status": "Camera opened successfully"})
				return True

		self.transport.send(
			{"error": f"Camera {reason} failover exhausted all backends"}
		)
		return False
