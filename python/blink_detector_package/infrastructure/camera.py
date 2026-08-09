import sys
import time

import cv2
import numpy as np

TARGET_FPS = 10
PROCESSING_RESOLUTION = (320, 240)

# Frames below this mean luma (0–255) are treated as black / unusable.
BLACK_LUMA_THRESHOLD = 12.0
WARMUP_READS = 12
WARMUP_MIN_GOOD = 2
# Runtime: reopen/failover after this many consecutive black seconds.
BLACK_STREAK_S = 2.0
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

	def emit_camera_state(self, kind, **fields):
		payload = {"kind": kind, **fields}
		self.transport.send({"cameraState": payload})

	def _platform_backends(self):
		if sys.platform == "win32":
			# Prefer MSMF (closer to Discord/Windows Camera); DSHOW failover.
			return [cv2.CAP_MSMF, cv2.CAP_DSHOW, cv2.CAP_ANY]
		if sys.platform == "darwin":
			return [cv2.CAP_AVFOUNDATION, cv2.CAP_ANY]
		return [cv2.CAP_V4L2, cv2.CAP_ANY]

	def _candidate_pairs(self):
		"""Ordered (index, backend) attempts: preferred first, then scan."""
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

		for backend in backends:
			for index in range(5):
				add(index, backend)
		return pairs

	def _apply_capture_props(self, capture=None):
		cap = capture if capture is not None else self.capture
		if cap is None:
			return
		# MJPG before size — common fix for black/partial frames on Windows.
		try:
			cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
		except Exception:
			pass
		try:
			cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
		except Exception:
			pass
		width, height = self.processing_resolution
		cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
		cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
		cap.set(cv2.CAP_PROP_FPS, self.target_fps)

		actual_width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
		actual_height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
		actual_fps = cap.get(cv2.CAP_PROP_FPS)
		actual_fourcc = fourcc_to_str(cap.get(cv2.CAP_PROP_FOURCC))
		self.fourcc = actual_fourcc or self.fourcc
		self.emit_camera_state(
			"camera_props",
			requested_wh=[width, height],
			requested_fps=self.target_fps,
			actual_wh=[actual_width, actual_height],
			actual_fps=actual_fps,
			fourcc=actual_fourcc,
			backend=self.backend,
			backend_name=backend_name(self.backend)
			if self.backend is not None
			else None,
			index=self.camera_index,
		)
		self.transport.send(
			{
				"debug": (
					"Camera resolution set to: "
					f"{actual_width}x{actual_height}, FPS: {actual_fps}"
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
		if self.active and self.capture is not None:
			self.capture.set(cv2.CAP_PROP_FPS, self.target_fps)

	def update_processing_resolution(self, processing_resolution):
		self.processing_resolution = tuple(processing_resolution)
		if self.active and self.capture is not None:
			self._apply_capture_props()

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

	def recover_from_black_frames(self, reset_detection, streak_ms, mean_luma_value):
		"""Reopen with next backend/index after a sustained black streak."""
		from_meta = self.snapshot_meta()
		self.emit_camera_state(
			"camera_black_streak",
			streak_ms=streak_ms,
			mean_luma=mean_luma_value,
			action="failover",
			**{k: from_meta[k] for k in ("index", "backend", "backend_name")},
		)
		pairs = self._candidate_pairs()
		# Skip current pair; rotate through remaining.
		current = (self.camera_index, self.backend)
		ordered = [p for p in pairs if p != current] + (
			[current] if current in pairs else []
		)
		self._release_capture()
		self.active = False

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
				reason="black_streak",
			)
			self.capture = opened
			self.active = True
			self._preferred_index = index
			self._preferred_backend = backend
			reset_detection()
			self.transport.send({"status": "Camera opened successfully"})
			return True

		self.transport.send(
			{"error": "Camera black-frame failover exhausted all backends"}
		)
		return False
