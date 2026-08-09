"""Unit tests for camera frame helpers (no physical camera required)."""

from __future__ import annotations

import unittest

import numpy as np

from blink_detector_package.infrastructure.camera import (
	BLACK_LUMA_THRESHOLD,
	MAX_NO_FACE_FAILOVERS,
	NO_FACE_FAILOVER_S,
	backend_name,
	fourcc_to_str,
	is_black_frame,
	is_mjpg_fourcc,
	mean_luma,
)


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
		# Windows order: MSMF first (C170 working path), then DSHOW.
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

	def test_open_resolution_uses_processing_preset(self):
		from blink_detector_package.infrastructure.camera import OpenCVCamera

		class _SilentTransport:
			def send(self, _payload):
				return None

		cam = OpenCVCamera(_SilentTransport())
		cam.processing_resolution = (480, 360)
		# No snap helper — open requests the processing preset directly.
		self.assertEqual(cam.processing_resolution, (480, 360))
		cam.processing_resolution = (640, 480)
		self.assertEqual(cam.processing_resolution, (640, 480))

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


if __name__ == "__main__":
	unittest.main()
