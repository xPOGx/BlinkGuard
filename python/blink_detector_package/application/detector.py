import json
import sys
import time

import cv2

from blink_detector_package.domain import (
	BLINK_DISPLAY_DURATION,
	DEFAULT_POSE_STRICTNESS,
	BlinkDetectionState,
	estimate_head_pose,
	select_largest_face,
)
from blink_detector_package.domain.ear import calculate_ear_fast
from blink_detector_package.infrastructure.camera import OpenCVCamera
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
		self.detection = BlinkDetectionState()
		self.send_video = False
		self.last_blink_display_time = 0.0
		# Phase 3 hooks — defaults match Phase 2 / prior every-frame detect.
		self.face_detect_interval = 1
		self.pose_strictness = DEFAULT_POSE_STRICTNESS
		self.detector_backend = "dlib"
		self._cached_face = None
		self._frames_since_face_detect = 0
		self._last_skip_debug_time = 0.0

	def process_commands(self):
		while not self.transport.command_queue.empty():
			try:
				line = self.transport.command_queue.get_nowait()
				data = json.loads(line)
				self.transport.send(
					{"debug": f"Processing command: {data}"}
				)

				# Config keys are independent so a multi-key quality preset
				# message can set FPS, resolution, interval, and pose together.
				if "target_fps" in data:
					self.camera.update_target_fps(data["target_fps"])
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
						self.transport.send(
							{"status": "Cleared EAR calibration"}
						)
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

				if "detector_backend" in data:
					requested = data["detector_backend"]
					notify = bool(data.get("notify", False))
					if requested == "mediapipe":
						# MediaPipe is not packaged yet — keep dlib working.
						self.detector_backend = "dlib"
						msg = (
							"MediaPipe backend not bundled yet; using dlib"
						)
						if notify:
							self.transport.send({"error": msg})
						else:
							self.transport.send({"status": msg})
						self.transport.send({"debug": msg})
					else:
						self.detector_backend = "dlib"
						self.transport.send(
							{"status": "Using dlib detector backend"}
						)

				if "request_video" in data:
					self.send_video = True
					self.transport.send(
						{"status": "Video streaming enabled"}
					)
				elif "start_camera" in data:
					if self.camera.start(self.detection.reset):
						self._cached_face = None
						self._frames_since_face_detect = 0
						self.transport.send(
							{"status": "Camera started successfully"}
						)
					else:
						self.transport.send(
							{"error": "Failed to start camera"}
						)
				elif "stop_camera" in data:
					self.camera.stop()
					self.send_video = False
					self._cached_face = None
					self.transport.send({"status": "Camera stopped"})
			except json.JSONDecodeError as error:
				self.transport.send(
					{"debug": f"JSON decode error: {str(error)}"}
				)
			except Exception as error:
				self.transport.send(
					{"debug": f"Command processing error: {str(error)}"}
				)

	def _resolve_face(self, detector, gray):
		"""Run HOG face detect on interval; otherwise reuse largest bbox."""
		should_detect = (
			self._cached_face is None
			or self._frames_since_face_detect >= self.face_detect_interval
		)
		if should_detect:
			faces = detector(gray, 0)
			face = select_largest_face(faces)
			self._cached_face = face
			self._frames_since_face_detect = 1
			return face

		self._frames_since_face_detect += 1
		return self._cached_face

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

		payload = {
			"credited": bool(credited),
			"phase": blink_info.get("phase"),
			"ear": float(blink_info["ear"])
			if blink_info.get("ear") is not None
			else None,
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
			"pose_strictness": blink_info.get("pose_strictness")
			or self.pose_strictness,
			"peak_velocity": float(
				blink_info.get("peak_velocity")
				or blink_info.get("velocity")
				or 0.0
			),
			"min_velocity": float(blink_info.get("min_velocity") or 0.0),
			"duration": float(blink_info.get("duration") or 0.0),
			"cooldown_remaining": float(
				blink_info.get("cooldown_remaining") or 0.0
			),
			"threshold": float(blink_info.get("threshold") or 0.0),
			"require_bilateral": bool(
				blink_info.get("require_bilateral", False)
			),
			"face_area": face_area,
			"target_fps": int(self.camera.target_fps),
			"face_detect_interval": int(self.face_detect_interval),
			"processing_resolution": list(self.camera.processing_resolution),
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
		line = (
			f"{prefix}: EAR={max_drop_ear:.3f}, baseline={baseline:.3f}, "
			f"drop={drop:.1%}, abs={absolute_drop:.3f}, "
			f"dur={payload['duration']:.3f}s, "
			f"vel={payload['peak_velocity']:.2f}/{payload['min_velocity']:.2f}, "
			f"L/R={left_s}/{right_s} asym={asym_s}, "
			f"yaw={payload['yaw']:.2f}, pitch={payload['pitch']:.2f}, "
			f"dPitch={payload['pitch_delta']:.2f}, restPitch={resting_s}, "
			f"lookDown={payload['look_down']}, "
			f"strict={payload['pose_strictness']}, "
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
					"velocity, bilateral, and pose gates is active"
				)
			}
		)

		frame_count = 0
		last_frame_time = time.time()
		default_face_data = {
			"faceDetected": False,
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
				if not ret:
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
				gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
				face = self._resolve_face(detector, gray)
				face_data = default_face_data.copy()

				if face is not None:
					landmarks, left_eye, right_eye = get_face_landmarks(
						predictor,
						gray,
						face,
						buffers,
					)
					left_ear = calculate_ear_fast(left_eye, buffers)
					right_ear = calculate_ear_fast(right_eye, buffers)
					avg_ear = (left_ear + right_ear) * 0.5
					pose = estimate_head_pose(landmarks)
					frame_width = frame.shape[1]
					frame_height = frame.shape[0]
					face_data["faceDetected"] = True
					face_data["ear"] = float(avg_ear)
					face_data["faceRect"] = {
						"x": float(face.left() / frame_width),
						"y": float(face.top() / frame_height),
						"width": float(face.width() / frame_width),
						"height": float(face.height() / frame_height),
					}

					buffers.concatenated_eyes[:6] = left_eye
					buffers.concatenated_eyes[6:] = right_eye
					for index in range(12):
						buffers.normalized_landmarks[index]["x"] = float(
							buffers.concatenated_eyes[index, 0] / frame_width
						)
						buffers.normalized_landmarks[index]["y"] = float(
							buffers.concatenated_eyes[index, 1] / frame_height
						)
					face_data["eyeLandmarks"] = (
						buffers.normalized_landmarks.copy()
					)

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
					elif phase in (
						"skip_yaw",
						"skip_degraded",
						"skip_eyes_closed",
						"skip_await_open",
					):
						# Rate-limit continuous skip spam while pose is bad.
						if current_time - self._last_skip_debug_time >= 0.5:
							self._last_skip_debug_time = current_time
							debug_payload = self._emit_blink_outcome(
								{
									**blink_info,
									"ear": avg_ear,
									"left_ear": left_ear,
									"right_ear": right_ear,
									"pose_strictness": self.pose_strictness,
									"resting_pitch": self.detection.resting_pitch,
									"look_down": False,
									"min_velocity": 0.0,
									"duration": 0.0,
									"cooldown_remaining": 0.0,
									"absolute_drop": 0.0,
								},
								face=face,
								credited=False,
							)
							face_data["blinkDebug"] = debug_payload
					elif (
						current_time - self.last_blink_display_time
					) < BLINK_DISPLAY_DURATION:
						face_data["blink"] = True

					if (
						blink_info
						and self.detection.current_baseline_ear > 0
					):
						face_data["baseline"] = float(
							self.detection.current_baseline_ear
						)
						face_data["blink_phase"] = blink_info.get(
							"phase",
							"monitoring",
						)
						if blink_info.get("phase") == "monitoring":
							current_ear_drop_absolute = (
								self.detection.current_baseline_ear - avg_ear
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
				else:
					self._cached_face = None

				if face_data.get("faceDetected", False):
					self.transport.send({"faceData": face_data})
				else:
					self.transport.send_serialized(NO_FACE_DATA)

				if (
					self.send_video
					and face_data.get("faceDetected", False)
				):
					if self.camera.processing_resolution == (640, 480):
						frame_base64 = encode_frame(frame)
					else:
						display_frame = cv2.resize(frame, (640, 480))
						frame_base64 = encode_frame(display_frame)
					self.transport.send(
						{"videoStream": frame_base64}
					)
				frame_count += 1
		except KeyboardInterrupt:
			self.transport.send(
				{"status": "Stopping blink detector..."}
			)
		finally:
			self.camera.stop()


def run():
	BlinkDetectorApplication().run()
