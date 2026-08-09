import json
import os
import sys
import time
from pathlib import Path

import cv2

from blink_detector_package.domain import (
	BLINK_DISPLAY_DURATION,
	DEFAULT_POSE_STRICTNESS,
	MIN_FACE_AREA_PX,
	MIN_INTEROCULAR_PX,
	BlinkDetectionState,
	estimate_head_pose,
	face_bbox_area,
	interocular_distance_px,
	select_largest_face,
)
from blink_detector_package.domain.blink_detection import (
	DEFAULT_TARGET_FPS,
	FACE_MISS_HOLD_FRAMES,
	FACE_QUALITY_HOLD_FRAMES,
	FACE_REACQUIRE_FRAMES,
)
from blink_detector_package.domain.ear import calculate_ear_fast
from blink_detector_package.infrastructure.camera import (
	BLACK_STREAK_S,
	HEALTH_INTERVAL_S,
	NO_FACE_FAILOVER_S,
	OpenCVCamera,
	is_black_frame,
	mean_luma,
)
from blink_detector_package.infrastructure.models import load_models
from blink_detector_package.infrastructure.transport import NdjsonTransport
from blink_detector_package.infrastructure.vision import (
	PreallocatedBuffers,
	encode_frame,
	get_face_landmarks,
)

NO_FACE_DATA = json.dumps(
	{
		"faceData": {
			"faceDetected": False,
			"faceStatus": "none",
			"ear": 0.0,
			"blink": False,
			"faceRect": {"x": 0, "y": 0, "width": 0, "height": 0},
			"eyeLandmarks": [],
		}
	}
)


class BlinkDetectorApplication:
	def __init__(self, transport=None):
		self.transport = transport or NdjsonTransport()
		self.camera = OpenCVCamera(self.transport)
		self.detection = BlinkDetectionState(
			target_fps=self.camera.target_fps,
		)
		self.send_video = False
		self.last_blink_display_time = 0.0
		# Phase 3 hooks — defaults match Phase 2 / prior every-frame detect.
		self.face_detect_interval = 1
		self.pose_strictness = DEFAULT_POSE_STRICTNESS
		self._cached_face = None
		self._frames_since_face_detect = 0
		self._face_miss_streak = 0
		self._quality_miss_streak = 0
		self._face_reacquire_frames = 0
		self._last_clahe_roi_count = 0
		self._last_skip_debug_time = 0.0
		self._last_skip_debug_phase = None
		self._last_near_miss_debug_time = 0.0
		# Preview follows target_fps (Ultra=30); encode stays light via size/q.
		self._last_video_emit = 0.0
		self._video_min_interval = 1.0 / max(8, int(self.camera.target_fps or 10))
		self._loop_dt_ema = 0.0
		self._last_gate_fps_update = 0.0
		self._last_processed_frame_time = 0.0
		self._reset_capture_health()

	def _reset_capture_health(self):
		self._health_window_start = time.time()
		self._health_frames = 0
		self._health_black = 0
		self._health_luma_sum = 0.0
		self._health_face_ok = 0
		self._health_face_none = 0
		self._health_face_too_far = 0
		self._black_streak_start = None
		self._no_face_streak_start = None
		self._session_face_ok = 0
		self._session_frames = 0
		self._last_health_emit = 0.0

	def _note_frame_health(self, frame, face_status, current_time):
		luma = mean_luma(frame)
		black = is_black_frame(frame)
		self._health_frames += 1
		self._health_luma_sum += luma
		if black:
			self._health_black += 1
			if self._black_streak_start is None:
				self._black_streak_start = current_time
		else:
			self._black_streak_start = None

		if face_status == "ok":
			self._health_face_ok += 1
		elif face_status == "too_far":
			self._health_face_too_far += 1
		else:
			self._health_face_none += 1

		if current_time - self._last_health_emit >= HEALTH_INTERVAL_S:
			self._emit_camera_health(current_time)
		return black, luma

	def _frame_luma_and_black(self, frame, current_time):
		"""Track black streak / luma without committing faceStatus counts yet."""
		luma = mean_luma(frame)
		black = is_black_frame(frame)
		if black:
			if self._black_streak_start is None:
				self._black_streak_start = current_time
		else:
			self._black_streak_start = None
		return black, luma

	def _commit_frame_health(self, luma, black, face_status, current_time):
		self._health_frames += 1
		self._health_luma_sum += luma
		self._session_frames += 1
		if black:
			self._health_black += 1
		if face_status == "ok":
			self._health_face_ok += 1
			self._session_face_ok += 1
			self._no_face_streak_start = None
		elif face_status == "too_far":
			self._health_face_too_far += 1
			# too_far still means capture works — do not count as no-face failover.
			self._no_face_streak_start = None
		else:
			self._health_face_none += 1
			if not black and self._session_face_ok == 0:
				if self._no_face_streak_start is None:
					self._no_face_streak_start = current_time
		if current_time - self._last_health_emit >= HEALTH_INTERVAL_S:
			self._emit_camera_health(current_time)

	def _maybe_failover_no_face(self, current_time):
		"""MSMF can report Success yet never yield a detectable face — try DSHOW."""
		if self._session_face_ok > 0:
			return False
		if self._no_face_streak_start is None:
			return False
		if current_time - self._no_face_streak_start < NO_FACE_FAILOVER_S:
			return False
		if self._session_frames < 5:
			return False
		streak_ms = int((current_time - self._no_face_streak_start) * 1000)
		ok = self.camera.recover_from_no_face(self.detection.reset, streak_ms)
		self._cached_face = None
		self._reset_capture_health()
		return ok

	def _emit_camera_health(self, current_time):
		frames = max(1, self._health_frames)
		meta = self.camera.snapshot_meta()
		black_ratio = self._health_black / frames
		face_ok = self._health_face_ok
		face_none = self._health_face_none
		mean = self._health_luma_sum / frames
		loop_fps = (
			round(1.0 / self._loop_dt_ema, 2) if self._loop_dt_ema > 0 else None
		)
		self.camera.emit_camera_state(
			"camera_health",
			frames=self._health_frames,
			mean_luma=mean,
			black_ratio=black_ratio,
			face_ok=face_ok,
			face_none=face_none,
			face_too_far=self._health_face_too_far,
			send_video=self.send_video,
			window_s=round(current_time - self._health_window_start, 3),
			loop_fps=loop_fps,
			gate_fps=round(float(self.detection.target_fps), 2),
			**meta,
		)
		self.transport.send(
			{
				"debug": (
					"camera_health "
					f"frames={self._health_frames} "
					f"luma={mean:.1f} black={black_ratio:.2f} "
					f"face_ok={face_ok} face_none={face_none} "
					f"loop_fps={loop_fps} gate_fps={self.detection.target_fps:.1f} "
					f"backend={meta.get('backend_name')}"
				)
			}
		)
		self._health_window_start = current_time
		self._health_frames = 0
		self._health_black = 0
		self._health_luma_sum = 0.0
		self._health_face_ok = 0
		self._health_face_none = 0
		self._health_face_too_far = 0
		self._last_health_emit = current_time

	def process_commands(self):
		"""Drain stdin batch: apply config before stop/start to avoid MSMF thrash."""
		batch = []
		while not self.transport.command_queue.empty():
			try:
				line = self.transport.command_queue.get_nowait()
				batch.append(json.loads(line))
			except json.JSONDecodeError as error:
				self.transport.send(
					{"debug": f"JSON decode error: {str(error)}"}
				)
			except Exception as error:
				self.transport.send(
					{"debug": f"Command read error: {str(error)}"}
				)

		if not batch:
			return

		for data in batch:
			self.transport.send({"debug": f"Processing command: {data}"})

		merged = {}
		want_stop = False
		want_start = False
		want_video = False
		for data in batch:
			for key in (
				"target_fps",
				"processing_resolution",
				"face_detect_interval",
				"pose_strictness",
				"ear_calibration",
			):
				if key in data:
					merged[key] = data[key]
			if "stop_camera" in data:
				want_stop = True
				want_start = False
			if "start_camera" in data:
				want_start = True
			if "request_video" in data:
				want_video = True

		try:
			self._apply_config_dict(merged)

			if want_stop:
				self.camera.stop(reason="stop_camera")
				self.send_video = False
				self._cached_face = None
				self._face_miss_streak = 0
				self._reset_capture_health()
				self.transport.send({"status": "Camera stopped"})

			if want_start:
				if self.camera.start(self.detection.reset):
					self._cached_face = None
					self._face_miss_streak = 0
					self._frames_since_face_detect = 0
					self._reset_capture_health()
					self.transport.send(
						{"status": "Camera started successfully"}
					)
				else:
					self.transport.send({"error": "Failed to start camera"})

			if want_video:
				self.send_video = True
				self._sync_video_emit_interval()
				self.transport.send({"status": "Video streaming enabled"})
		except Exception as error:
			self.transport.send(
				{"debug": f"Command processing error: {str(error)}"}
			)

	def _sync_video_emit_interval(self):
		"""Match preview cadence to quality preset (not a hard 10 FPS cap)."""
		try:
			fps = int(self.camera.target_fps)
		except (TypeError, ValueError):
			fps = 15
		fps = max(8, min(fps, 30))
		self._video_min_interval = 1.0 / float(fps)

	def _preview_encode_options(self):
		"""Lighter JPEG at higher target FPS so encode does not add lag."""
		try:
			fps = int(self.camera.target_fps)
		except (TypeError, ValueError):
			fps = 15
		if fps >= 25:
			return {"max_width": 400, "quality": 40}
		if fps >= 18:
			return {"max_width": 480, "quality": 45}
		return {"max_width": 480, "quality": 50}

	def _apply_config_dict(self, data):
		if "target_fps" in data:
			self.camera.update_target_fps(data["target_fps"])
			self.detection.set_target_fps(self.camera.target_fps)
			self._sync_video_emit_interval()
			self.transport.send(
				{
					"status": (
						"Updated target FPS to "
						f"{self.camera.target_fps}"
					)
				}
			)
		if "processing_resolution" in data:
			self.camera.update_processing_resolution(
				data["processing_resolution"]
			)
			self.transport.send(
				{
					"status": (
						"Updated processing resolution to "
						f"{self.camera.processing_resolution}"
					)
				}
			)
		if "face_detect_interval" in data:
			try:
				interval = int(data["face_detect_interval"])
			except (TypeError, ValueError):
				interval = 1
			self.face_detect_interval = max(1, interval)
			self._frames_since_face_detect = 0
			self.transport.send(
				{
					"status": (
						"Updated face detect interval to "
						f"{self.face_detect_interval}"
					)
				}
			)
		if "pose_strictness" in data:
			value = data["pose_strictness"]
			if value in ("loose", "normal", "strict"):
				self.pose_strictness = value
				self.detection.pose_strictness = value
				self.transport.send(
					{
						"status": (
							"Updated pose strictness to "
							f"{self.pose_strictness}"
						)
					}
				)
			else:
				self.transport.send(
					{
						"debug": (
							"Ignored invalid pose_strictness: "
							f"{value}"
						)
					}
				)

		if "ear_calibration" in data:
			value = data["ear_calibration"]
			if value is None or value == 0:
				self.detection.set_ear_calibration(None)
				self.transport.send({"status": "Cleared EAR calibration"})
			else:
				applied = self.detection.set_ear_calibration(value)
				if applied:
					self.transport.send(
						{
							"status": (
								"Applied EAR calibration "
								f"{self.detection.ear_calibration:.4f}"
							)
						}
					)
				else:
					self.transport.send(
						{
							"debug": (
								"Ignored invalid ear_calibration: "
								f"{value}"
							)
						}
					)

	def _emit_video_stream(self, frame, face_data=None):
		"""JPEG plus same-frame overlay so preview dots/box stay locked to video.

		Cadence tracks target_fps (Ultra → 30). Encode is downscaled/quality-
		scaled so high presets stay responsive without a fixed 10 FPS cap.
		"""
		now = time.time()
		# Half-interval slack: avoid skipping a paced loop frame on tiny jitter.
		if now - self._last_video_emit < self._video_min_interval * 0.5:
			return
		self._last_video_emit = now
		frame_base64 = encode_frame(frame, **self._preview_encode_options())
		payload = {"jpeg": frame_base64}
		if face_data:
			payload["faceRect"] = face_data.get("faceRect")
			payload["eyeLandmarks"] = face_data.get("eyeLandmarks")
			payload["faceStatus"] = face_data.get("faceStatus")
			payload["faceDetected"] = face_data.get("faceDetected")
		self.transport.send({"videoStream": payload})

	def _update_measured_gate_fps(self, current_time, frame_dt):
		"""Drive blink gates from achieved loop rate, not just the quality preset."""
		if frame_dt <= 0 or frame_dt > 1.0:
			return
		if self._loop_dt_ema <= 0:
			self._loop_dt_ema = frame_dt
		else:
			self._loop_dt_ema = (0.85 * self._loop_dt_ema) + (0.15 * frame_dt)
		if current_time - self._last_gate_fps_update < 1.0:
			return
		self._last_gate_fps_update = current_time
		measured = 1.0 / max(self._loop_dt_ema, 1e-3)
		# Never invent a higher rate than the configured target.
		configured = float(self.camera.target_fps or DEFAULT_TARGET_FPS)
		gate_fps = max(8.0, min(configured, measured))
		self.detection.set_target_fps(gate_fps)

	def _resolve_face(self, detector, gray):
		"""Run HOG face detect on interval; otherwise reuse largest bbox.

		While a blink candidate is active, re-detect every frame so a stale
		bbox (performance face_detect_interval>1) cannot poison mid-blink EAR.
		After a hard face loss, force every-frame HOG for FACE_REACQUIRE_FRAMES
		so performance presets re-lock quickly. Do not force every-frame detect
		merely because preview is on — HOG flicker while talking showed
		face-missing UI (POG 2026-08-09). Brief miss hold keeps last bbox.
		"""
		interval = self.face_detect_interval
		should_detect = (
			self._cached_face is None
			or self._frames_since_face_detect >= interval
			or self.detection.blink_in_progress
			or self._face_reacquire_frames > 0
		)
		if should_detect:
			faces = detector(gray, 0)
			face = select_largest_face(faces)
			if face is not None:
				self._cached_face = face
				self._face_miss_streak = 0
				self._frames_since_face_detect = 1
				if self._face_reacquire_frames > 0:
					self._face_reacquire_frames -= 1
				return face
			self._face_miss_streak += 1
			if (
				self._cached_face is not None
				and self._face_miss_streak <= FACE_MISS_HOLD_FRAMES
			):
				self._frames_since_face_detect = 1
				return self._cached_face
			self._cached_face = None
			self._face_reacquire_frames = FACE_REACQUIRE_FRAMES
			self._frames_since_face_detect = 1
			return None

		self._frames_since_face_detect += 1
		if self._face_reacquire_frames > 0:
			self._face_reacquire_frames -= 1
		return self._cached_face

	def _face_quality_ok(self, face, landmarks):
		"""Reject tiny / junk faces before EAR (symmetric noise bypasses asymmetry)."""
		area = face_bbox_area(face) if face is not None else 0
		interocular = interocular_distance_px(landmarks)
		ok = area >= MIN_FACE_AREA_PX and interocular >= MIN_INTEROCULAR_PX
		return ok, area, interocular

	def _emit_soft_face_quality_skip(
		self,
		face_data,
		face,
		frame_width,
		frame_height,
		current_time,
		face_area,
		interocular,
	):
		"""Skip EAR on quality blip; hold face; cancel only after hold expires."""
		self._quality_miss_streak += 1
		soft_hold = self._quality_miss_streak <= FACE_QUALITY_HOLD_FRAMES
		face_data["faceRect"] = {
			"x": float(face.left() / frame_width),
			"y": float(face.top() / frame_height),
			"width": float(face.width() / frame_width),
			"height": float(face.height() / frame_height),
		}
		had_candidate = False
		if soft_hold:
			# Keep bbox / faceDetected — do not cancel mid-blink on 1–2 frame
			# quality noise (POG L1 Phase C).
			face_data["faceDetected"] = True
			face_data["faceStatus"] = "ok"
		else:
			if self.detection.blink_in_progress:
				had_candidate = self.detection.cancel_on_face_lost(current_time)
			else:
				self.detection.mark_face_absent(current_time)
			face_data["faceDetected"] = False
			face_data["faceStatus"] = "too_far"

		if had_candidate or self._should_emit_skip(
			"skip_face_quality",
			current_time,
		):
			if had_candidate:
				self._last_skip_debug_phase = "skip_face_quality"
				self._last_skip_debug_time = current_time
			self._emit_blink_outcome(
				{
					"phase": "skip_face_quality",
					"baseline": self.detection.current_baseline_ear,
					"drop": 0.0,
					"ear": 0.0,
					"face_area": face_area,
					"interocular": interocular,
					"quality_miss_streak": self._quality_miss_streak,
					"soft_hold": soft_hold,
					"look_down": False,
					"ear_depressed": self.detection.ear_depressed,
					"live_open_ear": self.detection.live_open_ear,
					"pose_strictness": self.pose_strictness,
					"resting_pitch": self.detection.resting_pitch,
					"min_velocity": 0.0,
					"duration": 0.0,
					"cooldown_remaining": 0.0,
					"absolute_drop": 0.0,
				},
				face=face,
				credited=False,
			)

	def _should_emit_skip(self, phase, current_time):
		"""Emit immediately on phase change; throttle repeats of same skip."""
		if phase != self._last_skip_debug_phase:
			self._last_skip_debug_phase = phase
			self._last_skip_debug_time = current_time
			return True
		if current_time - self._last_skip_debug_time >= 0.5:
			self._last_skip_debug_time = current_time
			return True
		return False

	def _emit_face_lost(self, current_time, had_candidate):
		"""Emit skip_face_lost only when an in-progress candidate was cancelled."""
		if not had_candidate:
			return
		self._last_skip_debug_phase = "skip_face_lost"
		self._last_skip_debug_time = current_time
		self._emit_blink_outcome(
			{
				"phase": "skip_face_lost",
				"baseline": self.detection.current_baseline_ear,
				"drop": 0.0,
				"ear": 0.0,
				"ear_raw": 0.0,
				"ear_smooth": 0.0,
				"peak_velocity": 0.0,
				"peak_velocity_raw": 0.0,
				"peak_velocity_effective": 0.0,
				"peak_opening_velocity": 0.0,
				"closed_frames": 0,
				"min_velocity": 0.0,
				"duration": 0.0,
				"cooldown_remaining": 0.0,
				"absolute_drop": 0.0,
				"yaw": 0.0,
				"pitch": 0.0,
				"pitch_delta": 0.0,
				"look_down": False,
				"ear_depressed": self.detection.ear_depressed,
				"treat_as_look_down": False,
				"live_open_ear": self.detection.live_open_ear,
				"pose_strictness": self.pose_strictness,
				"resting_pitch": self.detection.resting_pitch,
			},
			face=None,
			credited=False,
		)

	def _blink_debug_payload(self, blink_info, face=None, credited=False):
		"""Structured + human-readable blink debug for tuning."""
		baseline = float(blink_info.get("baseline") or 0.0)
		drop = float(blink_info.get("drop") or 0.0)
		max_drop_ear = blink_info.get("max_drop_ear")
		if max_drop_ear is None and baseline > 0:
			max_drop_ear = baseline * (1.0 - drop)
		max_drop_ear = float(max_drop_ear or 0.0)
		absolute_drop = float(
			blink_info.get("absolute_drop")
			if blink_info.get("absolute_drop") is not None
			else (baseline - max_drop_ear)
		)
		left_ear = blink_info.get("left_ear")
		right_ear = blink_info.get("right_ear")
		resting = blink_info.get("resting_pitch")
		face_area = None
		if face is not None:
			try:
				face_area = int(face.width()) * int(face.height())
			except Exception:
				face_area = None

		def _opt_float(key):
			value = blink_info.get(key)
			return float(value) if value is not None else None

		payload = {
			"credited": bool(credited),
			"phase": blink_info.get("phase"),
			"ear": float(blink_info["ear"])
			if blink_info.get("ear") is not None
			else None,
			"ear_raw": _opt_float("ear_raw"),
			"ear_smooth": _opt_float("ear_smooth"),
			"baseline": baseline,
			"drop": drop,
			"drop_pct": drop * 100.0,
			"absolute_drop": absolute_drop,
			"max_drop_ear": max_drop_ear,
			"left_ear": float(left_ear) if left_ear is not None else None,
			"right_ear": float(right_ear) if right_ear is not None else None,
			"asymmetry": float(blink_info["asymmetry"])
			if blink_info.get("asymmetry") is not None
			else None,
			"yaw": float(blink_info.get("yaw") or 0.0),
			"pitch": float(blink_info.get("pitch") or 0.0),
			"pitch_delta": float(blink_info.get("pitch_delta") or 0.0),
			"resting_pitch": float(resting) if resting is not None else None,
			"look_down": bool(blink_info.get("look_down", False)),
			"ear_depressed": bool(blink_info.get("ear_depressed", False)),
			"treat_as_look_down": bool(
				blink_info.get("treat_as_look_down", False)
			),
			"live_open_ear": _opt_float("live_open_ear"),
			"pose_strictness": blink_info.get("pose_strictness")
			or self.pose_strictness,
			"peak_velocity": float(
				blink_info.get("peak_velocity")
				or blink_info.get("velocity")
				or 0.0
			),
			"peak_velocity_raw": _opt_float("peak_velocity_raw"),
			"peak_velocity_effective": _opt_float("peak_velocity_effective"),
			"peak_opening_velocity": float(
				blink_info.get("peak_opening_velocity") or 0.0
			),
			"closed_frames": int(blink_info.get("closed_frames") or 0),
			"min_velocity": float(blink_info.get("min_velocity") or 0.0),
			"duration": float(blink_info.get("duration") or 0.0),
			"cooldown_remaining": float(
				blink_info.get("cooldown_remaining") or 0.0
			),
			"threshold": float(blink_info.get("threshold") or 0.0),
			"require_bilateral": bool(
				blink_info.get("require_bilateral", False)
			),
			"face_area": (
				int(blink_info["face_area"])
				if blink_info.get("face_area") is not None
				else face_area
			),
			"interocular": _opt_float("interocular"),
			"target_fps": int(self.camera.target_fps),
			"face_detect_interval": int(self.face_detect_interval),
			"processing_resolution": list(self.camera.processing_resolution),
			"detector_backend": "dlib",
			"clahe": self._last_clahe_roi_count > 0,
			"clahe_roi_count": int(self._last_clahe_roi_count),
		}

		phase = payload["phase"] or "?"
		prefix = "Blink credited" if credited else f"Blink rejected ({phase})"
		resting_s = (
			f"{payload['resting_pitch']:.2f}"
			if payload["resting_pitch"] is not None
			else "n/a"
		)
		left_s = (
			f"{payload['left_ear']:.3f}"
			if payload["left_ear"] is not None
			else "n/a"
		)
		right_s = (
			f"{payload['right_ear']:.3f}"
			if payload["right_ear"] is not None
			else "n/a"
		)
		asym_s = (
			f"{payload['asymmetry']:.2f}"
			if payload["asymmetry"] is not None
			else "n/a"
		)
		ear_raw_s = (
			f"{payload['ear_raw']:.3f}"
			if payload["ear_raw"] is not None
			else "n/a"
		)
		ear_smooth_s = (
			f"{payload['ear_smooth']:.3f}"
			if payload["ear_smooth"] is not None
			else "n/a"
		)
		line = (
			f"{prefix}: EAR={max_drop_ear:.3f}, baseline={baseline:.3f}, "
			f"drop={drop:.1%}, abs={absolute_drop:.3f}, "
			f"dur={payload['duration']:.3f}s, "
			f"vel={payload['peak_velocity']:.2f}/{payload['min_velocity']:.2f}, "
			f"openVel={payload['peak_opening_velocity']:.2f}, "
			f"closed={payload['closed_frames']}, "
			f"raw/smooth={ear_raw_s}/{ear_smooth_s}, "
			f"L/R={left_s}/{right_s} asym={asym_s}, "
			f"yaw={payload['yaw']:.2f}, pitch={payload['pitch']:.2f}, "
			f"dPitch={payload['pitch_delta']:.2f}, restPitch={resting_s}, "
			f"lookDown={payload['look_down']}, "
			f"strict={payload['pose_strictness']}, "
			f"backend={payload['detector_backend']}, "
			f"cdLeft={payload['cooldown_remaining']:.3f}s, "
			f"fps={payload['target_fps']}, "
			f"fInt={payload['face_detect_interval']}, "
			f"res={payload['processing_resolution']}, "
			f"faceArea={face_area}"
		)
		return payload, line

	def _emit_blink_outcome(self, blink_info, face=None, credited=False):
		payload, line = self._blink_debug_payload(
			blink_info, face=face, credited=credited
		)
		self.transport.send({"debug": line})
		self.transport.send({"blinkDebug": payload})
		return payload

	def _fill_eye_landmarks_ui(self, face_data, left_eye, right_eye, buffers, frame_width, frame_height):
		buffers.concatenated_eyes[:6] = left_eye
		buffers.concatenated_eyes[6:] = right_eye
		for index in range(12):
			buffers.normalized_landmarks[index]["x"] = float(
				buffers.concatenated_eyes[index, 0] / frame_width
			)
			buffers.normalized_landmarks[index]["y"] = float(
				buffers.concatenated_eyes[index, 1] / frame_height
			)
		face_data["eyeLandmarks"] = buffers.normalized_landmarks.copy()

	def _handle_detection(
		self,
		face_data,
		avg_ear,
		current_time,
		left_ear,
		right_ear,
		pose,
		face,
	):
		blink_detected, blink_info = self.detection.detect(
			avg_ear,
			current_time,
			left_ear=left_ear,
			right_ear=right_ear,
			pose=pose,
		)
		phase = (blink_info or {}).get("phase")
		if blink_detected and blink_info:
			self.last_blink_display_time = current_time
			face_data["blink"] = True
			max_drop_ear = blink_info.get(
				"max_drop_ear",
				avg_ear,
			)
			self.transport.send(
				{
					"blink": True,
					"ear": float(max_drop_ear),
					"baseline": float(blink_info["baseline"]),
					"drop_percentage": float(blink_info["drop"]),
					"duration": float(blink_info["duration"]),
					"time": float(current_time),
				}
			)
			debug_payload = self._emit_blink_outcome(
				blink_info,
				face=face,
				credited=True,
			)
			face_data["blinkDebug"] = debug_payload
		elif phase and str(phase).startswith("reject_"):
			debug_payload = self._emit_blink_outcome(
				blink_info,
				face=face,
				credited=False,
			)
			face_data["blinkDebug"] = debug_payload
		elif phase == "start":
			debug_payload = self._emit_blink_outcome(
				blink_info,
				face=face,
				credited=False,
			)
			face_data["blinkDebug"] = debug_payload
		elif phase == "baseline_drift_nudge":
			debug_payload = self._emit_blink_outcome(
				blink_info,
				face=face,
				credited=False,
			)
			face_data["blinkDebug"] = debug_payload
		elif phase in (
			"skip_yaw",
			"skip_degraded",
			"skip_eyes_closed",
			"skip_await_open",
			"skip_cooldown",
			"skip_face_quality",
		):
			if self._should_emit_skip(phase, current_time):
				debug_payload = self._emit_blink_outcome(
					{
						**blink_info,
						"ear": avg_ear,
						"left_ear": left_ear,
						"right_ear": right_ear,
						"pose_strictness": self.pose_strictness,
						"resting_pitch": self.detection.resting_pitch,
						"look_down": blink_info.get("look_down", False),
						"min_velocity": blink_info.get("min_velocity", 0.0),
						"duration": 0.0,
						"absolute_drop": blink_info.get("absolute_drop", 0.0),
					},
					face=face,
					credited=False,
				)
				face_data["blinkDebug"] = debug_payload
		elif phase == "monitoring" and blink_info:
			vel = float(blink_info.get("velocity") or 0.0)
			min_vel = float(blink_info.get("min_velocity") or 0.35)
			ref = float(
				blink_info.get("live_open_ear")
				or blink_info.get("baseline")
				or 0.0
			)
			close_band = blink_info.get("close_band_ear")
			ear_s = float(blink_info.get("ear_smooth") or avg_ear)
			near_band = (
				close_band is not None
				and ref > 0
				and ear_s <= float(close_band) * 1.02
				and ear_s > float(close_band)
			)
			near_vel = vel >= min_vel * 0.75
			if (near_band or near_vel) and (
				current_time - self._last_near_miss_debug_time >= 0.5
			):
				self._last_near_miss_debug_time = current_time
				debug_payload = self._emit_blink_outcome(
					{
						**blink_info,
						"phase": "near_miss",
						"ear": avg_ear,
						"left_ear": left_ear,
						"right_ear": right_ear,
						"duration": 0.0,
					},
					face=face,
					credited=False,
				)
				face_data["blinkDebug"] = debug_payload
		elif (
			current_time - self.last_blink_display_time
		) < BLINK_DISPLAY_DURATION:
			face_data["blink"] = True

		if blink_info and self.detection.current_baseline_ear > 0:
			face_data["baseline"] = float(
				self.detection.current_baseline_ear
			)
			face_data["blink_phase"] = blink_info.get(
				"phase",
				"monitoring",
			)
			if blink_info.get("phase") == "monitoring":
				smooth = blink_info.get("ear_smooth", avg_ear)
				current_ear_drop_absolute = (
					self.detection.current_baseline_ear - smooth
				)
				if current_ear_drop_absolute > 0:
					face_data["ear_drop_absolute"] = float(
						current_ear_drop_absolute
					)
					face_data["ear_drop_percentage"] = float(
						current_ear_drop_absolute
						/ self.detection.current_baseline_ear
					)
		elif self.detection.current_baseline_ear == 0:
			face_data["blink_phase"] = "initializing"

	def run(self):
		self.transport.send(
			{"status": "Starting blink detector in standby mode..."}
		)
		detector, predictor, predictor_path = load_models()
		if detector is None or predictor is None:
			self.transport.send(
				{
					"error": (
						"Facial landmark model not found at: "
						f"{predictor_path}"
					)
				}
			)
			sys.exit(1)

		buffers = PreallocatedBuffers()
		self.transport.send(
			{
				"status": (
					"Models loaded successfully, ready for camera activation"
				)
			}
		)
		self.transport.send(
			{
				"debug": (
					"Advanced blink detection with dynamic baseline, "
					"EAR smooth, velocity, bilateral, and pose gates is active"
				)
			}
		)
		try:
			exe_path = Path(sys.executable)
			if getattr(sys, "frozen", False):
				mtime = os.path.getmtime(exe_path)
				self.transport.send(
					{
						"debug": (
							f"Blink binary: {exe_path} "
							f"mtime_utc={time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(mtime))}"
						)
					}
				)
		except OSError:
			pass

		frame_count = 0
		last_frame_time = time.time()
		default_face_data = {
			"faceDetected": False,
			"faceStatus": "none",
			"ear": 0.0,
			"blink": False,
			"faceRect": {
				"x": 0,
				"y": 0,
				"width": 0,
				"height": 0,
			},
			"eyeLandmarks": [],
		}
		self.transport.start_input_thread()

		try:
			while True:
				self.process_commands()
				if (
					not self.camera.active
					or self.camera.capture is None
				):
					time.sleep(0.1)
					continue

				current_time = time.time()
				# Recompute each frame so live target_fps updates take effect.
				frame_interval = 1.0 / self.camera.target_fps
				if current_time - last_frame_time < frame_interval:
					time.sleep(0.001)
					continue
				last_frame_time = current_time

				ret, frame = self.camera.capture.read()
				if not ret or frame is None:
					self.transport.send({"error": "Failed to read frame"})
					time.sleep(0.1)
					continue

				current_shape = frame.shape[:2]
				target_shape = self.camera.processing_resolution[::-1]
				if current_shape != target_shape:
					frame = cv2.resize(
						frame,
						self.camera.processing_resolution,
					)

				face_data = default_face_data.copy()
				# Black / empty capture: skip HOG (avoids junk mouth boxes) but
				# still stream preview + health so diagnostics stay honest.
				black, luma = self._frame_luma_and_black(frame, current_time)
				if black:
					self._commit_frame_health(
						luma, True, "none", current_time
					)
					if (
						self._black_streak_start is not None
						and current_time - self._black_streak_start
						>= BLACK_STREAK_S
					):
						streak_ms = int(
							(current_time - self._black_streak_start) * 1000
						)
						self.camera.recover_from_black_frames(
							self.detection.reset,
							streak_ms,
							luma,
						)
						self._cached_face = None
						self._reset_capture_health()
						if self._last_processed_frame_time > 0:
							self._update_measured_gate_fps(
								current_time,
								current_time - self._last_processed_frame_time,
							)
						self._last_processed_frame_time = current_time
						continue

					self._cached_face = None
					had_candidate = self.detection.cancel_on_face_lost(
						current_time
					)
					self._emit_face_lost(current_time, had_candidate)
					self.transport.send_serialized(NO_FACE_DATA)
					if self.send_video:
						self._emit_video_stream(frame)
					if self._last_processed_frame_time > 0:
						self._update_measured_gate_fps(
							current_time,
							current_time - self._last_processed_frame_time,
						)
					self._last_processed_frame_time = current_time
					frame_count += 1
					continue

				frame_width = frame.shape[1]
				frame_height = frame.shape[0]
				face = None
				left_eye = None
				right_eye = None
				landmarks = None

				gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
				# HOG on raw gray — CLAHE only for shape_predictor (L2-A).
				face = self._resolve_face(detector, gray)
				if face is not None:
					landmarks, left_eye, right_eye = get_face_landmarks(
						predictor,
						gray,
						face,
						buffers,
					)
					self._last_clahe_roi_count = int(
						buffers.clahe_roi_count or 0
					)

				if face is not None and left_eye is not None:
					quality_ok, face_area, interocular = self._face_quality_ok(
						face,
						landmarks,
					)
					if not quality_ok:
						self._emit_soft_face_quality_skip(
							face_data,
							face,
							frame_width,
							frame_height,
							current_time,
							face_area,
							interocular,
						)
					else:
						self._quality_miss_streak = 0
						left_ear = calculate_ear_fast(left_eye, buffers)
						right_ear = calculate_ear_fast(right_eye, buffers)
						avg_ear = (left_ear + right_ear) * 0.5
						pose = estimate_head_pose(landmarks)
						face_data["faceDetected"] = True
						face_data["faceStatus"] = "ok"
						face_data["ear"] = float(avg_ear)
						face_data["faceRect"] = {
							"x": float(face.left() / frame_width),
							"y": float(face.top() / frame_height),
							"width": float(face.width() / frame_width),
							"height": float(face.height() / frame_height),
						}
						self._fill_eye_landmarks_ui(
							face_data,
							left_eye,
							right_eye,
							buffers,
							frame_width,
							frame_height,
						)
						self._handle_detection(
							face_data,
							avg_ear,
							current_time,
							left_ear,
							right_ear,
							pose,
							face,
						)
				else:
					if face is not None:
						# HOG ok but landmarks missing — same soft hold as
						# quality floors (area/IOD). Keep bbox; avoid UI flash.
						area = face_bbox_area(face)
						self._emit_soft_face_quality_skip(
							face_data,
							face,
							frame_width,
							frame_height,
							current_time,
							area,
							0.0,
						)
					else:
						self._cached_face = None
						self._face_miss_streak = 0
						self._quality_miss_streak = 0
						self._face_reacquire_frames = FACE_REACQUIRE_FRAMES
						self._last_clahe_roi_count = 0
						had_candidate = self.detection.cancel_on_face_lost(
							current_time
						)
						self._emit_face_lost(current_time, had_candidate)

				self._commit_frame_health(
					luma,
					False,
					face_data.get("faceStatus") or "none",
					current_time,
				)
				if self._maybe_failover_no_face(current_time):
					frame_count += 1
					continue

				if face_data.get("faceStatus") == "none":
					self.transport.send_serialized(NO_FACE_DATA)
				else:
					self.transport.send({"faceData": face_data})

				if self.send_video:
					self._emit_video_stream(frame, face_data)
				if self._last_processed_frame_time > 0:
					self._update_measured_gate_fps(
						current_time,
						current_time - self._last_processed_frame_time,
					)
				self._last_processed_frame_time = current_time
				frame_count += 1
		except KeyboardInterrupt:
			self.transport.send(
				{"status": "Stopping blink detector..."}
			)
		finally:
			self.camera.stop(reason="detector_exit")
			self.transport.send({"status": "Blink detector stopped"})
			self.transport.stop()


def run():
	BlinkDetectorApplication().run()
