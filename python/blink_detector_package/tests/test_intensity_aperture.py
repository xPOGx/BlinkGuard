"""Stage 3.5 — intensity aperture from eye-crop vertical gradients."""

from __future__ import annotations

import unittest

import numpy as np

from blink_detector_package.infrastructure.vision import (
	eye_intensity_aperture,
	get_intensity_aperture_enabled,
	set_intensity_aperture_enabled,
)


def _eye_pts(cx: float, cy: float, *, w: float = 40.0, h: float = 16.0):
	"""Six dlib-order points for an open-ish eye."""
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


def _synthetic_open_eye(h: int = 80, w: int = 120) -> tuple[np.ndarray, np.ndarray]:
	"""Bright sclera band between dark lids → large aperture."""
	gray = np.full((h, w), 40, dtype=np.uint8)
	cy, cx = h // 2, w // 2
	# Dark lids + bright open slit.
	gray[cy - 10 : cy - 6, cx - 30 : cx + 30] = 20
	gray[cy - 6 : cy + 6, cx - 30 : cx + 30] = 200
	gray[cy + 6 : cy + 10, cx - 30 : cx + 30] = 20
	pts = _eye_pts(float(cx), float(cy), w=48.0, h=18.0)
	return gray, pts


def _synthetic_closed_eye(h: int = 80, w: int = 120) -> tuple[np.ndarray, np.ndarray]:
	"""Thin dark line only → small aperture."""
	gray = np.full((h, w), 90, dtype=np.uint8)
	cy, cx = h // 2, w // 2
	gray[cy - 1 : cy + 2, cx - 30 : cx + 30] = 15
	pts = _eye_pts(float(cx), float(cy), w=48.0, h=4.0)
	return gray, pts


class IntensityApertureTests(unittest.TestCase):
	def tearDown(self):
		set_intensity_aperture_enabled(True)

	def test_enabled_flag(self):
		self.assertTrue(get_intensity_aperture_enabled())
		self.assertFalse(set_intensity_aperture_enabled(False))
		gray, pts = _synthetic_open_eye()
		self.assertIsNone(eye_intensity_aperture(gray, pts))
		self.assertTrue(set_intensity_aperture_enabled(True))

	def test_open_greater_than_closed(self):
		open_gray, open_pts = _synthetic_open_eye()
		closed_gray, closed_pts = _synthetic_closed_eye()
		open_ap = eye_intensity_aperture(open_gray, open_pts)
		closed_ap = eye_intensity_aperture(closed_gray, closed_pts)
		self.assertIsNotNone(open_ap)
		self.assertIsNotNone(closed_ap)
		self.assertGreater(open_ap, closed_ap)
		self.assertGreater(open_ap, 0.12)
		self.assertLess(closed_ap, open_ap * 0.6)

	def test_tiny_crop_returns_none(self):
		gray = np.zeros((20, 20), dtype=np.uint8)
		# Points almost on top of each other → crop < 8×6 after clamp.
		pts = _eye_pts(10.0, 10.0, w=2.0, h=1.0)
		self.assertIsNone(eye_intensity_aperture(gray, pts))

	def test_bad_inputs(self):
		self.assertIsNone(eye_intensity_aperture(None, _eye_pts(10, 10)))
		gray = np.zeros((40, 40), dtype=np.uint8)
		self.assertIsNone(eye_intensity_aperture(gray, None))
		self.assertIsNone(eye_intensity_aperture(gray, np.zeros((5, 2))))


if __name__ == "__main__":
	unittest.main()
