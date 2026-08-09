"""Unit tests for camera frame helpers (no physical camera required)."""

from __future__ import annotations

import unittest

import numpy as np

from blink_detector_package.infrastructure.camera import (
	BLACK_LUMA_THRESHOLD,
	backend_name,
	fourcc_to_str,
	is_black_frame,
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

	def test_candidate_pairs_index_major_before_empty_indices(self):
		import cv2

		from blink_detector_package.infrastructure.camera import OpenCVCamera

		class _SilentTransport:
			def send(self, _payload):
				return None

		cam = OpenCVCamera(_SilentTransport())
		# Force Windows-like backend list regardless of host OS.
		cam._platform_backends = lambda: [cv2.CAP_MSMF, cv2.CAP_DSHOW]
		pairs = cam._candidate_pairs()
		self.assertEqual(pairs[0], (0, cv2.CAP_MSMF))
		self.assertEqual(pairs[1], (0, cv2.CAP_DSHOW))
		# DSHOW@0 must appear before probing MSMF on index 1.
		self.assertLess(pairs.index((0, cv2.CAP_DSHOW)), pairs.index((1, cv2.CAP_MSMF)))


if __name__ == "__main__":
	unittest.main()
