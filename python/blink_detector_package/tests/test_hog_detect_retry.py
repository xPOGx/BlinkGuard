"""Miss-only HOG CLAHE / upsample retry (no real dlib detector required)."""

from __future__ import annotations

import unittest

import numpy as np

from blink_detector_package.domain.blink_detection import FACE_MISS_HOLD_FRAMES
from blink_detector_package.infrastructure.vision import (
	PreallocatedBuffers,
	prepare_hog_detect_gray,
	run_hog_face_detect,
)


class _FakeFace:
	def __init__(self, w=80, h=80):
		self._w = w
		self._h = h

	def left(self):
		return 10

	def top(self):
		return 10

	def right(self):
		return 10 + self._w

	def bottom(self):
		return 10 + self._h

	def width(self):
		return self._w

	def height(self):
		return self._h


class HogDetectRetryTests(unittest.TestCase):
	def test_face_miss_hold_is_twelve(self):
		self.assertEqual(FACE_MISS_HOLD_FRAMES, 12)

	def test_prepare_hog_detect_gray_returns_enhanced_copy(self):
		gray = np.linspace(0, 255, 80 * 100, dtype=np.uint8).reshape(80, 100)
		buffers = PreallocatedBuffers()
		enhanced = prepare_hog_detect_gray(gray, buffers)
		self.assertIsNotNone(enhanced)
		self.assertEqual(enhanced.shape, gray.shape)
		self.assertIs(enhanced, buffers.temp_frame)
		# CLAHE should change contrast on a ramp (not identical to raw).
		self.assertFalse(np.array_equal(enhanced, gray))

	def test_raw_hit_skips_retries(self):
		hit = _FakeFace()
		calls = []

		def detector(gray, upsample):
			calls.append(upsample)
			return [hit] if upsample == 0 else []

		def select_largest(faces):
			return faces[0] if faces else None

		gray = np.zeros((64, 64), dtype=np.uint8)
		face, kind = run_hog_face_detect(
			detector,
			gray,
			select_largest,
			PreallocatedBuffers(),
		)
		self.assertIs(face, hit)
		self.assertIsNone(kind)
		self.assertEqual(calls, [0])

	def test_clahe_retry_order(self):
		hit = _FakeFace()
		calls = []

		def detector(gray, upsample):
			calls.append((upsample, int(gray.mean())))
			# First raw call misses; CLAHE-enhanced (higher mean after apply on
			# non-flat) — we key off call count instead.
			if len(calls) == 1:
				return []
			if len(calls) == 2:
				return [hit]
			return []

		def select_largest(faces):
			return faces[0] if faces else None

		gray = np.linspace(20, 200, 64 * 64, dtype=np.uint8).reshape(64, 64)
		face, kind = run_hog_face_detect(
			detector,
			gray,
			select_largest,
			PreallocatedBuffers(),
		)
		self.assertIs(face, hit)
		self.assertEqual(kind, "clahe")
		self.assertEqual([c[0] for c in calls], [0, 0])

	def test_upsample_retry_after_clahe_miss(self):
		hit = _FakeFace()
		calls = []

		def detector(gray, upsample):
			calls.append(upsample)
			if upsample == 1:
				return [hit]
			return []

		def select_largest(faces):
			return faces[0] if faces else None

		gray = np.zeros((64, 64), dtype=np.uint8)
		face, kind = run_hog_face_detect(
			detector,
			gray,
			select_largest,
			PreallocatedBuffers(),
		)
		self.assertIs(face, hit)
		self.assertEqual(kind, "upsample")
		self.assertEqual(calls, [0, 0, 1])

	def test_all_miss_returns_none(self):
		def detector(gray, upsample):
			return []

		gray = np.zeros((64, 64), dtype=np.uint8)
		face, kind = run_hog_face_detect(
			detector,
			gray,
			lambda faces: faces[0] if faces else None,
			PreallocatedBuffers(),
		)
		self.assertIsNone(face)
		self.assertIsNone(kind)


if __name__ == "__main__":
	unittest.main()
