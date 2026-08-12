"""Stage 3.1 — ROI upscale before shape_predictor (float landmarks)."""

from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest import mock

import numpy as np

from blink_detector_package.domain.ear import calculate_ear_fast
from blink_detector_package.infrastructure import vision as vision_mod
from blink_detector_package.infrastructure.vision import (
	PreallocatedBuffers,
	_fill_landmarks_from_shape,
	_predict_shape_on_gray,
	get_face_landmarks,
	get_landmark_roi_upscale,
	set_landmark_roi_upscale,
)


class _FakePart:
	def __init__(self, x: float, y: float):
		self.x = x
		self.y = y


class _FakeShape:
	def __init__(self, parts: list[_FakePart]):
		self._parts = parts

	def part(self, index: int) -> _FakePart:
		return self._parts[index]


def _open_eye_hexagon(cx: float, cy: float, *, w: float = 12.0, h: float = 6.0):
	"""Six points approximating an open eye (dlib eye order)."""
	return [
		(cx - w / 2, cy),
		(cx - w / 4, cy - h / 2),
		(cx + w / 4, cy - h / 2),
		(cx + w / 2, cy),
		(cx + w / 4, cy + h / 2),
		(cx - w / 4, cy + h / 2),
	]


class LandmarkRoiUpscaleTests(unittest.TestCase):
	def tearDown(self):
		set_landmark_roi_upscale(2)

	def test_set_upscale_clamps_to_one(self):
		self.assertEqual(set_landmark_roi_upscale(0), 1)
		self.assertEqual(get_landmark_roi_upscale(), 1)
		self.assertEqual(set_landmark_roi_upscale(3), 3)

	def test_buffers_are_float32(self):
		buffers = PreallocatedBuffers()
		self.assertEqual(buffers.landmarks_array.dtype, np.float32)
		self.assertEqual(buffers.left_eye.dtype, np.float32)
		self.assertEqual(buffers.right_eye.dtype, np.float32)

	def test_fill_maps_upscaled_parts_back_to_frame(self):
		buffers = PreallocatedBuffers()
		# Predictor ran on ROI upscaled ×2 starting at (10, 20).
		# Part at upscaled (30, 40) → frame (10 + 15, 20 + 20) = (25, 40).
		parts = [_FakePart(0.0, 0.0) for _ in range(68)]
		parts[0] = _FakePart(30.0, 40.0)
		shape = _FakeShape(parts)
		_fill_landmarks_from_shape(shape, buffers, x0=10.0, y0=20.0, scale=2.0)
		self.assertAlmostEqual(float(buffers.landmarks_array[0, 0]), 25.0)
		self.assertAlmostEqual(float(buffers.landmarks_array[0, 1]), 40.0)
		self.assertEqual(buffers.landmarks_array.dtype, np.float32)

	def test_predict_scale_one_skips_resize(self):
		gray = np.zeros((80, 100), dtype=np.uint8)
		face = SimpleNamespace(
			left=lambda: 20,
			top=lambda: 20,
			right=lambda: 60,
			bottom=lambda: 60,
			width=lambda: 40,
			height=lambda: 40,
		)
		buffers = PreallocatedBuffers()
		sentinel = object()
		predictor = mock.Mock(return_value=sentinel)
		shape, x0, y0, scale = _predict_shape_on_gray(
			predictor, gray, face, buffers, upscale=1
		)
		self.assertIs(shape, sentinel)
		self.assertEqual((x0, y0, scale), (0.0, 0.0, 1.0))
		predictor.assert_called_once_with(gray, face)

	def test_predict_upscale_resizes_and_maps_rect(self):
		gray = np.zeros((120, 160), dtype=np.uint8)
		face = SimpleNamespace(
			left=lambda: 40,
			top=lambda: 30,
			right=lambda: 100,
			bottom=lambda: 90,
			width=lambda: 60,
			height=lambda: 60,
		)
		buffers = PreallocatedBuffers()
		parts = [_FakePart(float(i), float(i)) for i in range(68)]
		fake_shape = _FakeShape(parts)

		def _predictor(img, rect):
			# Upscaled ROI should be larger than face bbox.
			self.assertGreaterEqual(img.shape[0], 60 * 2)
			self.assertGreaterEqual(img.shape[1], 60 * 2)
			self.assertGreaterEqual(rect.left(), 0)
			self.assertGreater(rect.right(), rect.left())
			return fake_shape

		with mock.patch.object(vision_mod, "dlib") as dlib_mod:
			dlib_mod.rectangle = mock.Mock(
				side_effect=lambda l, t, r, b: SimpleNamespace(
					left=lambda: l,
					top=lambda: t,
					right=lambda: r,
					bottom=lambda: b,
				)
			)
			shape, x0, y0, scale = _predict_shape_on_gray(
				_predictor, gray, face, buffers, upscale=2
			)
		self.assertIs(shape, fake_shape)
		self.assertEqual(scale, 2.0)
		self.assertGreaterEqual(x0, 0.0)
		self.assertGreaterEqual(y0, 0.0)

	def test_get_face_landmarks_float_and_ear_stable(self):
		"""Upscale path returns float coords; EAR close to scale=1 on clear eye."""
		gray = np.full((160, 200), 40, dtype=np.uint8)
		face = SimpleNamespace(
			left=lambda: 40,
			top=lambda: 40,
			right=lambda: 140,
			bottom=lambda: 140,
			width=lambda: 100,
			height=lambda: 100,
		)
		# Build 68 parts in *frame* coords; predictor receives mapped ROI coords.
		left = _open_eye_hexagon(70.0, 80.0)
		right = _open_eye_hexagon(110.0, 80.0)
		frame_parts = [(0.0, 0.0)] * 68
		for i, pt in enumerate(left):
			frame_parts[36 + i] = pt
		for i, pt in enumerate(right):
			frame_parts[42 + i] = pt
		# Nose tip etc. for completeness
		frame_parts[30] = (90.0, 100.0)

		def make_predictor(scale: int, x0: float, y0: float):
			def _pred(img, rect):
				parts = []
				for fx, fy in frame_parts:
					# Inverse of fill mapping: upscaled = (frame - origin) * scale
					parts.append(_FakePart((fx - x0) * scale, (fy - y0) * scale))
				return _FakeShape(parts)

			return _pred

		buffers1 = PreallocatedBuffers()
		# scale=1: x0=y0=0
		with mock.patch.object(
			vision_mod,
			"_predict_shape_on_gray",
			return_value=(
				make_predictor(1, 0.0, 0.0)(gray, face),
				0.0,
				0.0,
				1.0,
			),
		):
			_, left1, right1 = get_face_landmarks(
				lambda *a: None, gray, face, buffers1, upscale=1
			)
		ear1 = calculate_ear_fast(left1, buffers1)

		buffers2 = PreallocatedBuffers()
		x0, y0 = 32.0, 32.0
		with mock.patch.object(
			vision_mod,
			"_predict_shape_on_gray",
			return_value=(
				make_predictor(2, x0, y0)(None, None),
				x0,
				y0,
				2.0,
			),
		):
			lm2, left2, right2 = get_face_landmarks(
				lambda *a: None, gray, face, buffers2, upscale=2
			)
		self.assertEqual(lm2.dtype, np.float32)
		self.assertEqual(left2.dtype, np.float32)
		# With exact inverse mapping, EAR matches baseline path
		ear2 = calculate_ear_fast(left2, buffers2)
		self.assertAlmostEqual(ear1, ear2, places=5)
		# left eye corner0 is cx - w/2 = 70 - 6
		self.assertAlmostEqual(float(left2[0, 0]), 64.0, places=5)
		# Half-pixel input survives as float (not truncated to int)
		buffers3 = PreallocatedBuffers()
		with mock.patch.object(
			vision_mod,
			"_predict_shape_on_gray",
			return_value=(
				_FakeShape(
					[
						_FakePart((fx - x0) * 2 + 0.5, (fy - y0) * 2)
						for fx, fy in frame_parts
					]
				),
				x0,
				y0,
				2.0,
			),
		):
			_, left3, _ = get_face_landmarks(
				lambda *a: None, gray, face, buffers3, upscale=2
			)
		self.assertAlmostEqual(float(left3[0, 0]), 64.0 + 0.25, places=5)


if __name__ == "__main__":
	unittest.main()
