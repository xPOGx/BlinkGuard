"""L2-A local CLAHE helpers (no dlib / camera required)."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest import mock

import numpy as np

from blink_detector_package.infrastructure import vision as vision_mod
from blink_detector_package.infrastructure.vision import (
	CLAHE_MAX_FACE_LUMA,
	PreallocatedBuffers,
	prepare_predictor_gray,
	roi_from_face,
)


class VisionClaheTests(unittest.TestCase):
	def test_roi_from_face(self):
		face = SimpleNamespace(
			left=lambda: 20,
			top=lambda: 30,
			right=lambda: 80,
			bottom=lambda: 90,
			width=lambda: 60,
			height=lambda: 60,
		)
		roi = roi_from_face(face, (120, 120))
		self.assertEqual(roi, (17, 27, 83, 93))

	def test_prepare_disabled_by_default(self):
		gray = np.full((80, 100), 30, dtype=np.uint8)
		buffers = PreallocatedBuffers()
		face = SimpleNamespace(
			left=lambda: 20,
			top=lambda: 30,
			right=lambda: 70,
			bottom=lambda: 70,
			width=lambda: 50,
			height=lambda: 40,
		)
		enhanced, count = prepare_predictor_gray(gray, face, buffers)
		self.assertEqual(count, 0)
		self.assertIs(enhanced, gray)

	def test_prepare_skips_clahe_when_face_bright(self):
		gray = np.full((80, 100), 120, dtype=np.uint8)
		buffers = PreallocatedBuffers()
		face = SimpleNamespace(
			left=lambda: 20,
			top=lambda: 30,
			right=lambda: 70,
			bottom=lambda: 70,
			width=lambda: 50,
			height=lambda: 40,
		)
		with mock.patch.object(vision_mod, "CLAHE_ENABLED", True):
			enhanced, count = prepare_predictor_gray(gray, face, buffers)
		self.assertEqual(count, 0)
		self.assertIs(enhanced, gray)
		self.assertGreaterEqual(120, CLAHE_MAX_FACE_LUMA)

	def test_prepare_applies_face_clahe_when_dark_and_enabled(self):
		gray = np.full((80, 100), 30, dtype=np.uint8)
		gray[30:70, 20:70] = 25
		buffers = PreallocatedBuffers()
		face = SimpleNamespace(
			left=lambda: 20,
			top=lambda: 30,
			right=lambda: 70,
			bottom=lambda: 70,
			width=lambda: 50,
			height=lambda: 40,
		)
		with mock.patch.object(vision_mod, "CLAHE_ENABLED", True):
			enhanced, count = prepare_predictor_gray(gray, face, buffers)
		self.assertEqual(count, 1)
		self.assertIs(enhanced, buffers.temp_frame)
		self.assertFalse(np.array_equal(enhanced, gray))
		self.assertEqual(int(gray[40, 40]), 25)
		self.assertEqual(int(enhanced[5, 5]), 30)


if __name__ == "__main__":
	unittest.main()
