"""Miss-only HOG CLAHE / upsample retry (no real dlib detector required)."""

from __future__ import annotations

import unittest

import numpy as np

from blink_detector_package.domain.blink_detection import FACE_MISS_HOLD_FRAMES
from blink_detector_package.infrastructure.vision import (
	PreallocatedBuffers,
	HIGHLIGHT_COMPRESS_LUMA,
	compress_highlights,
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

	def test_idle_detect_interval_is_six(self):
		from blink_detector_package.domain.blink_detection import (
			FACE_IDLE_DETECT_INTERVAL,
			FACE_REACQUIRE_FRAMES,
		)

		self.assertEqual(FACE_IDLE_DETECT_INTERVAL, 6)
		self.assertEqual(FACE_REACQUIRE_FRAMES, 15)

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

	def test_weak_hog_score_dropped(self):
		hit = _FakeFace()

		class _Weak:
			def __call__(self, gray, upsample):
				return [hit]

			def run(self, gray, upsample, adjust=0.0):
				return [hit], [0.05], [0]

		gray = np.zeros((64, 64), dtype=np.uint8)
		face, kind = run_hog_face_detect(
			_Weak(),
			gray,
			lambda faces: faces[0] if faces else None,
			PreallocatedBuffers(),
		)
		self.assertIsNone(face)
		self.assertIsNone(kind)

	def test_edge_glued_small_box_dropped(self):
		class _EdgeFace:
			def __init__(self):
				self._w = 40
				self._h = 48

			def left(self):
				return 0

			def top(self):
				return 80

			def right(self):
				return 40

			def bottom(self):
				return 128

			def width(self):
				return self._w

			def height(self):
				return self._h

		edge = _EdgeFace()

		def detector(gray, upsample):
			return [edge]

		gray = np.zeros((360, 480), dtype=np.uint8)
		face, kind = run_hog_face_detect(
			detector,
			gray,
			lambda faces: faces[0] if faces else None,
			PreallocatedBuffers(),
		)
		self.assertIsNone(face)
		self.assertIsNone(kind)


	def test_upsample_eye_micro_box_dropped(self):
		"""upsample=1 must not return a ~44px eye as a face."""
		eye = _FakeFace(44, 44)

		def detector(gray, upsample):
			return [eye] if upsample == 1 else []

		gray = np.zeros((360, 480), dtype=np.uint8)
		face, kind = run_hog_face_detect(
			detector,
			gray,
			lambda faces: faces[0] if faces else None,
			PreallocatedBuffers(),
		)
		self.assertIsNone(face)
		self.assertIsNone(kind)

	def test_compress_retry_after_clahe_miss(self):
		hit = _FakeFace()
		calls = []

		def detector(gray, upsample):
			calls.append((upsample, int(gray.mean())))
			# 1=raw, 2=CLAHE, 3=highlight compress (all upsample=0).
			if upsample == 0 and len(calls) >= 3:
				return [hit]
			return []

		def select_largest(faces):
			return faces[0] if faces else None

		gray = np.full((64, 64), 180, dtype=np.uint8)
		self.assertGreaterEqual(float(gray.mean()), HIGHLIGHT_COMPRESS_LUMA)
		face, kind = run_hog_face_detect(
			detector,
			gray,
			select_largest,
			PreallocatedBuffers(),
		)
		self.assertIs(face, hit)
		self.assertEqual(kind, "compress")
		self.assertEqual(len(calls), 3)
		self.assertEqual([c[0] for c in calls], [0, 0, 0])
		self.assertLess(calls[-1][1], calls[0][1])

	def test_compress_highlights_darkens(self):
		gray = np.full((32, 32), 200, dtype=np.uint8)
		out = compress_highlights(gray)
		self.assertIsNotNone(out)
		self.assertLess(float(out.mean()), float(gray.mean()))


if __name__ == "__main__":
	unittest.main()
