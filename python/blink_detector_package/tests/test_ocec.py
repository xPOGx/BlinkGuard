"""Stage 7 — OCEC eye crop + OpenCV DNN load (no camera)."""

from __future__ import annotations

import os
import unittest

import numpy as np

from blink_detector_package.infrastructure.models import get_models_dir
from blink_detector_package.infrastructure.ocec import (
	OCEC_FILENAME,
	load_ocec,
	score_eye_open,
)
from blink_detector_package.infrastructure.vision import (
	crop_eye_bgr,
	get_ocec_enabled,
	set_ocec_enabled,
)


def _eye_pts(cx: float, cy: float, *, w: float = 40.0, h: float = 16.0):
	return np.array(
		[
			[cx - w / 2, cy],
			[cx - w / 4, cy - h / 2],
			[cx + w / 4, cy - h / 2],
			[cx + w / 2, cy],
			[cx + w / 4, cy + h / 2],
			[cx - w / 4, cy + h / 2],
		],
		dtype=np.float64,
	)


class OcecCropTests(unittest.TestCase):
	def tearDown(self):
		set_ocec_enabled(True)

	def test_flag_default_on(self):
		self.assertTrue(get_ocec_enabled())

	def test_tiny_crop_returns_none(self):
		gray = np.zeros((20, 20), dtype=np.uint8)
		pts = _eye_pts(10.0, 10.0, w=2.0, h=1.0)
		self.assertIsNone(crop_eye_bgr(gray, pts))

	def test_crop_from_gray_is_bgr(self):
		gray = np.full((80, 120), 90, dtype=np.uint8)
		pts = _eye_pts(60.0, 40.0, w=48.0, h=18.0)
		crop = crop_eye_bgr(gray, pts)
		self.assertIsNotNone(crop)
		self.assertEqual(crop.ndim, 3)
		self.assertEqual(crop.shape[2], 3)

	def test_bad_inputs(self):
		self.assertIsNone(crop_eye_bgr(None, _eye_pts(10, 10)))
		gray = np.zeros((40, 40), dtype=np.uint8)
		self.assertIsNone(crop_eye_bgr(gray, None))
		self.assertIsNone(crop_eye_bgr(gray, np.zeros((5, 2))))

	def test_score_none_when_disabled(self):
		set_ocec_enabled(False)
		bgr = np.zeros((80, 120, 3), dtype=np.uint8)
		pts = _eye_pts(60.0, 40.0)
		self.assertIsNone(score_eye_open(object(), bgr, pts))

	def test_load_missing_returns_none(self):
		self.assertIsNone(load_ocec(model_path=os.path.join("no", "such.onnx")))

	def test_load_and_score_when_onnx_present(self):
		path = os.path.join(get_models_dir(), OCEC_FILENAME)
		if not os.path.exists(path):
			self.skipTest(f"{OCEC_FILENAME} not in models dir")
		net = load_ocec(path)
		self.assertIsNotNone(net)
		set_ocec_enabled(True)
		bgr = np.full((80, 120, 3), 180, dtype=np.uint8)
		pts = _eye_pts(60.0, 40.0, w=48.0, h=18.0)
		prob = score_eye_open(net, bgr, pts)
		self.assertIsNotNone(prob)
		self.assertGreaterEqual(prob, 0.0)
		self.assertLessEqual(prob, 1.0)


if __name__ == "__main__":
	unittest.main()
