"""Unit tests for camera frame helpers (no physical camera required)."""

from __future__ import annotations

import unittest

import numpy as np

from blink_detector_package.infrastructure.camera import (
	BLACK_LUMA_THRESHOLD,
	MAX_NO_FACE_FAILOVERS,
	NO_FACE_FAILOVER_S,
	backend_name,
	enumerate_camera_device_names,
	fourcc_to_str,
	is_black_frame,
	is_mjpg_fourcc,
	mean_luma,
)
from blink_detector_package.infrastructure.vision import prepare_preview_frame


class CameraHelperTests(unittest.TestCase):
	def test_mean_luma_black_bgr(self):
		frame = np.zeros((40, 40, 3), dtype=np.uint8)
		self.assertLess(mean_luma(frame), 1.0)
		self.assertTrue(is_black_frame(frame))

	def test_mean_luma_bright_gray(self):
		frame = np.full((40, 40), 180, dtype=np.uint8)
		self.assertGreater(mean_luma(frame), BLACK_LUMA_THRESHOLD)
		self.assertFalse(is_black_frame(frame))

	def test_mean_luma_none_empty(self):
		self.assertEqual(mean_luma(None), 0.0)
		empty = np.zeros((0, 0, 3), dtype=np.uint8)
		self.assertEqual(mean_luma(empty), 0.0)

	def test_prepare_preview_frame_downscales_wide(self):
		frame = np.zeros((480, 640, 3), dtype=np.uint8)
		out = prepare_preview_frame(frame, max_width=480)
		self.assertEqual(out.shape[1], 480)
		self.assertEqual(out.shape[0], 360)
		small = np.zeros((240, 320, 3), dtype=np.uint8)
		self.assertIs(prepare_preview_frame(small, max_width=480), small)

	def test_backend_name_known(self):
		import cv2

		self.assertEqual(backend_name(cv2.CAP_DSHOW), "DSHOW")
		self.assertEqual(backend_name(cv2.CAP_MSMF), "MSMF")

	def test_fourcc_mjpg(self):
		import cv2

		code = cv2.VideoWriter_fourcc(*"MJPG")
		self.assertEqual(fourcc_to_str(code), "MJPG")
		self.assertTrue(is_mjpg_fourcc("MJPG"))
		self.assertTrue(is_mjpg_fourcc("GPJM"))
		self.assertFalse(is_mjpg_fourcc("YUY2"))

	def test_candidate_pairs_index_major_before_empty_indices(self):
		import cv2

		from blink_detector_package.infrastructure.camera import OpenCVCamera

		class _SilentTransport:
			def send(self, _payload):
				return None

		cam = OpenCVCamera(_SilentTransport())
		# Windows order: MSMF first (laptop-cam working path), then DSHOW.
		cam._platform_backends = lambda: [cv2.CAP_MSMF, cv2.CAP_DSHOW]
		pairs = cam._candidate_pairs()
		self.assertEqual(pairs[0], (0, cv2.CAP_MSMF))
		self.assertEqual(pairs[1], (0, cv2.CAP_DSHOW))
		# DSHOW@0 must appear before probing MSMF on index 1.
		self.assertLess(pairs.index((0, cv2.CAP_DSHOW)), pairs.index((1, cv2.CAP_MSMF)))

	def test_failover_order_prefers_dshow_after_msmf(self):
		import cv2

		from blink_detector_package.infrastructure.camera import OpenCVCamera

		class _SilentTransport:
			def send(self, _payload):
				return None

		cam = OpenCVCamera(_SilentTransport())
		cam._platform_backends = lambda: [cv2.CAP_MSMF, cv2.CAP_DSHOW]
		cam.camera_index = 0
		cam.backend = cv2.CAP_MSMF
		ordered = cam._failover_order()
		self.assertEqual(ordered[0], (0, cv2.CAP_DSHOW))
		self.assertNotIn((0, cv2.CAP_MSMF), ordered)

	def test_apply_capture_props_does_not_set_format(self):
		import cv2

		from blink_detector_package.infrastructure.camera import OpenCVCamera

		events = []

		class _Transport:
			def send(self, payload):
				events.append(payload)

		class _FakeCapture:
			def __init__(self):
				self.sets = []
				self.props = {
					cv2.CAP_PROP_FRAME_WIDTH: 1280,
					cv2.CAP_PROP_FRAME_HEIGHT: 720,
					cv2.CAP_PROP_FPS: 30,
					cv2.CAP_PROP_FOURCC: cv2.VideoWriter_fourcc(*"YUY2"),
				}

			def set(self, prop, value):
				self.sets.append((prop, value))
				return True

			def get(self, prop):
				return self.props.get(prop, 0)

		cam = OpenCVCamera(_Transport())
		cam.processing_resolution = (480, 360)
		cam.target_fps = 15
		cam.backend = cv2.CAP_MSMF
		cam.camera_index = 0
		fake = _FakeCapture()
		cam._apply_capture_props(fake)

		set_ids = [prop for prop, _ in fake.sets]
		self.assertNotIn(cv2.CAP_PROP_FRAME_WIDTH, set_ids)
		self.assertNotIn(cv2.CAP_PROP_FRAME_HEIGHT, set_ids)
		self.assertNotIn(cv2.CAP_PROP_FPS, set_ids)
		self.assertNotIn(cv2.CAP_PROP_FOURCC, set_ids)
		self.assertIn(cv2.CAP_PROP_BUFFERSIZE, set_ids)

		states = [
			e.get("cameraState")
			for e in events
			if isinstance(e.get("cameraState"), dict)
		]
		props_event = next(s for s in states if s.get("kind") == "camera_props")
		self.assertIsNone(props_event["requested_wh"])
		self.assertIsNone(props_event["requested_fps"])
		self.assertIsNone(props_event["requested_fourcc"])
		self.assertFalse(props_event["size_prop_set"])
		self.assertFalse(props_event["fps_prop_set"])
		self.assertEqual(props_event["processing_resolution"], [480, 360])
		self.assertEqual(props_event["target_fps"], 15)
		self.assertEqual(props_event["actual_wh"], [1280, 720])

	def test_device_name_for_index_soft_match(self):
		from blink_detector_package.infrastructure.camera import OpenCVCamera

		class _SilentTransport:
			def send(self, _payload):
				return None

		cam = OpenCVCamera(_SilentTransport())
		cam._device_names = ["Integrated Camera", "USB Webcam"]
		self.assertEqual(cam._device_name_for_index(0), "Integrated Camera")
		self.assertEqual(cam._device_name_for_index(1), "USB Webcam")
		self.assertIsNone(cam._device_name_for_index(2))
		self.assertIsNone(cam._device_name_for_index(None))

	def test_refresh_device_inventory_emits_camera_devices(self):
		from blink_detector_package.infrastructure.camera import OpenCVCamera

		events = []

		class _Transport:
			def send(self, payload):
				events.append(payload)

		cam = OpenCVCamera(_Transport())
		cam._device_names = []
		# Avoid real PowerShell / system_profiler in unit tests.
		import blink_detector_package.infrastructure.camera as camera_mod

		original = camera_mod.enumerate_camera_device_names
		camera_mod.enumerate_camera_device_names = lambda: [
			"Integrated Camera",
			"Logitech C170",
		]
		try:
			cam._refresh_device_inventory()
		finally:
			camera_mod.enumerate_camera_device_names = original

		states = [
			e.get("cameraState")
			for e in events
			if isinstance(e.get("cameraState"), dict)
		]
		devices_event = next(s for s in states if s.get("kind") == "camera_devices")
		self.assertEqual(devices_event["count"], 2)
		self.assertEqual(
			devices_event["names"],
			["Integrated Camera", "Logitech C170"],
		)
		self.assertEqual(cam._device_name_for_index(1), "Logitech C170")

	def test_enumerate_camera_device_names_returns_list(self):
		# Smoke: never raises; may be empty in CI/headless.
		names = enumerate_camera_device_names()
		self.assertIsInstance(names, list)

	def test_no_face_failover_constants(self):
		self.assertGreaterEqual(NO_FACE_FAILOVER_S, 3.0)
		self.assertGreaterEqual(MAX_NO_FACE_FAILOVERS, 1)

	def test_update_props_do_not_touch_capture(self):
		from blink_detector_package.infrastructure.camera import OpenCVCamera

		class _SilentTransport:
			def send(self, _payload):
				return None

		cam = OpenCVCamera(_SilentTransport())
		cam.active = True
		cam.capture = object()  # sentinel — must not call .set
		cam.update_target_fps(20)
		cam.update_processing_resolution([640, 480])
		self.assertEqual(cam.target_fps, 20)
		self.assertEqual(cam.processing_resolution, (640, 480))


class CommandBatchTests(unittest.TestCase):
	def test_config_applied_before_start_in_batch(self):
		from blink_detector_package.application.detector import (
			BlinkDetectorApplication,
		)

		events = []

		class _Transport:
			def __init__(self):
				import queue

				self.command_queue = queue.Queue()

			def send(self, payload):
				events.append(payload)

			def start_input_thread(self):
				return None

			def stop(self):
				return None

			def send_serialized(self, _line):
				return None

		transport = _Transport()
		app = BlinkDetectorApplication(transport=transport)

		started = []

		def _fake_start(reset):
			started.append(
				(
					app.camera.target_fps,
					app.camera.processing_resolution,
				)
			)
			app.camera.active = True
			return True

		app.camera.start = _fake_start
		app.camera.stop = lambda reason="stop_camera": None

		transport.command_queue.put('{"start_camera": true}')
		transport.command_queue.put(
			'{"target_fps": 20, "processing_resolution": [640, 480], '
			'"face_detect_interval": 1, "pose_strictness": "normal"}'
		)
		app.process_commands()
		self.assertEqual(started, [(20, (640, 480))])

	def test_quit_sets_should_exit_without_camera(self):
		from blink_detector_package.application.detector import (
			BlinkDetectorApplication,
		)

		class _Transport:
			def __init__(self):
				import queue

				self.command_queue = queue.Queue()

			def send(self, _payload):
				return None

			def start_input_thread(self):
				return None

			def stop(self):
				return None

			def send_serialized(self, _line):
				return None

		transport = _Transport()
		app = BlinkDetectorApplication(transport=transport)
		camera_stopped = []
		app.camera.stop = lambda reason="stop_camera": camera_stopped.append(
			reason
		)
		transport.command_queue.put('{"quit": true}')
		app.process_commands()
		self.assertTrue(app._should_exit)
		self.assertEqual(camera_stopped, [])


if __name__ == "__main__":
	unittest.main()
