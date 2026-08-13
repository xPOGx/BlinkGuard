"""YuNet-first face detect (no camera / no real ONNX required)."""

from __future__ import annotations

import os
import unittest

import numpy as np

from blink_detector_package.infrastructure.models import (
	get_yunet_path,
	load_yunet,
)
from blink_detector_package.infrastructure.vision import (
	PreallocatedBuffers,
	box_iou,
	hog_refine_yunet_box,
	pad_xywh_to_box,
	run_face_detect,
	run_yunet_face_detect,
	stabilize_face_rect,
	yunet_faces_to_rects,
)


class _FakeFace:
	def __init__(self, w=140, h=160, left=170, top=80):
		self._w = w
		self._h = h
		self._left = left
		self._top = top

	def left(self):
		return self._left

	def top(self):
		return self._top

	def right(self):
		return self._left + self._w

	def bottom(self):
		return self._top + self._h

	def width(self):
		return self._w

	def height(self):
		return self._h


class _FakeYunet:
	def __init__(self, faces):
		self.faces = faces
		self.sizes = []
		self.detect_calls = 0

	def setInputSize(self, size):
		self.sizes.append(tuple(size))

	def detect(self, bgr):
		del bgr
		self.detect_calls += 1
		return 1, self.faces


class _BoomYunet(_FakeYunet):
	def detect(self, bgr):
		del bgr
		raise RuntimeError("yunet failed")


def _bgr(h=360, w=480):
	return np.zeros((h, w, 3), dtype=np.uint8)


def _gray(h=360, w=480):
	return np.zeros((h, w), dtype=np.uint8)


def _select_largest(faces):
	return faces[0] if faces else None


class YunetDetectTests(unittest.TestCase):
	def test_pad_expands_and_clamps(self):
		box = pad_xywh_to_box(10, 10, 100, 100, 480, 360, pad_x=0.10, pad_y=0.20)
		self.assertEqual(box, (0, 0, 120, 130))
		edge = pad_xywh_to_box(400, 300, 100, 80, 480, 360)
		self.assertIsNotNone(edge)
		left, top, right, bottom = edge
		self.assertGreaterEqual(left, 0)
		self.assertGreaterEqual(top, 0)
		self.assertLess(right, 480)
		self.assertLess(bottom, 360)

	def test_yunet_hit_sets_input_size(self):
		faces = np.array(
			[[120.0, 60.0, 160.0, 180.0] + [0.0] * 10 + [0.9]],
			dtype=np.float32,
		)
		yunet = _FakeYunet(faces)
		bgr = _bgr()
		face, size = run_yunet_face_detect(yunet, bgr, _select_largest)
		self.assertIsNotNone(face)
		self.assertGreaterEqual(face.width(), 160)
		self.assertEqual(size, (480, 360))
		self.assertEqual(yunet.sizes, [(480, 360)])

	def test_yunet_skips_set_input_size_when_unchanged(self):
		faces = np.array(
			[[120.0, 60.0, 160.0, 180.0] + [0.0] * 10 + [0.9]],
			dtype=np.float32,
		)
		yunet = _FakeYunet(faces)
		buffers = PreallocatedBuffers()
		run_yunet_face_detect(yunet, _bgr(), _select_largest, buffers=buffers)
		run_yunet_face_detect(yunet, _bgr(), _select_largest, buffers=buffers)
		self.assertEqual(yunet.sizes, [(480, 360)])
		run_yunet_face_detect(yunet, _bgr(h=480, w=640), _select_largest, buffers=buffers)
		self.assertEqual(yunet.sizes, [(480, 360), (640, 480)])

	def test_yunet_micro_box_is_miss(self):
		faces = np.array(
			[[200.0, 140.0, 44.0, 44.0] + [0.0] * 10 + [0.85]],
			dtype=np.float32,
		)
		face, _size = run_yunet_face_detect(_FakeYunet(faces), _bgr(), _select_largest)
		self.assertIsNone(face)

	def test_yunet_none_falls_back_to_hog(self):
		hit = _FakeFace()

		def detector(gray, upsample):
			return [hit] if upsample == 0 else []

		face, kind = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			PreallocatedBuffers(),
			bgr=_bgr(),
			yunet=None,
		)
		self.assertIs(face, hit)
		self.assertEqual(kind, "hog")

	def test_missing_yunet_model_returns_none(self):
		self.assertIsNone(load_yunet(r"C:\no-such-yunet.onnx"))

	def test_yunet_hit_hog_miss_is_not_a_cnn_crop(self):
		calls = []

		def detector(gray, upsample):
			calls.append((gray.shape, upsample))
			return []

		faces = np.array(
			[[100.0, 50.0, 180.0, 200.0] + [0.0] * 10 + [0.8]],
			dtype=np.float32,
		)
		face, kind = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			PreallocatedBuffers(),
			bgr=_bgr(),
			yunet=_FakeYunet(faces),
		)
		self.assertIsNone(face)
		self.assertIsNone(kind)
		self.assertGreater(len(calls), 0)
		upsamples = [upsample for _shape, upsample in calls]
		self.assertNotIn(1, upsamples)
		roi_shapes = {shape for shape, _upsample in calls}
		self.assertTrue(all(h < 360 or w < 480 for h, w in roi_shapes))

	def test_yunet_hit_prefers_overlapping_hog_box(self):
		faces = np.array(
			[[100.0, 50.0, 180.0, 200.0] + [0.0] * 10 + [0.8]],
			dtype=np.float32,
		)
		yunet_face, _size = run_yunet_face_detect(
			_FakeYunet(faces), _bgr(), _select_largest
		)
		self.assertIsNotNone(yunet_face)
		from blink_detector_package.infrastructure.vision import HOG_REFINE_PAD

		roi = pad_xywh_to_box(
			yunet_face.left(),
			yunet_face.top(),
			yunet_face.width(),
			yunet_face.height(),
			480,
			360,
			pad_x=HOG_REFINE_PAD,
			pad_y=HOG_REFINE_PAD,
		)
		x0, y0, _x1, _y1 = roi
		local = _FakeFace(
			w=yunet_face.width(),
			h=yunet_face.height(),
			left=yunet_face.left() - x0,
			top=yunet_face.top() - y0,
		)

		def detector(gray, upsample):
			return [local] if upsample == 0 else []

		face, kind = hog_refine_yunet_box(
			detector,
			_gray(),
			yunet_face,
			_select_largest,
			PreallocatedBuffers(),
		)
		self.assertIsNotNone(face)
		self.assertIsNone(kind)
		self.assertAlmostEqual(face.left(), yunet_face.left(), delta=2)
		self.assertAlmostEqual(face.top(), yunet_face.top(), delta=2)

		face2, kind2 = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			PreallocatedBuffers(),
			bgr=_bgr(),
			yunet=_FakeYunet(faces),
		)
		self.assertEqual(kind2, "hog")
		self.assertAlmostEqual(face2.left(), yunet_face.left(), delta=2)

	def test_stable_yunet_skips_hog_refine(self):
		faces = np.array(
			[[100.0, 50.0, 180.0, 200.0] + [0.0] * 10 + [0.8]],
			dtype=np.float32,
		)
		yunet_face, _size = run_yunet_face_detect(
			_FakeYunet(faces), _bgr(), _select_largest
		)
		from blink_detector_package.infrastructure.vision import HOG_REFINE_PAD

		roi = pad_xywh_to_box(
			yunet_face.left(),
			yunet_face.top(),
			yunet_face.width(),
			yunet_face.height(),
			480,
			360,
			pad_x=HOG_REFINE_PAD,
			pad_y=HOG_REFINE_PAD,
		)
		x0, y0, _x1, _y1 = roi
		local = _FakeFace(
			w=yunet_face.width(),
			h=yunet_face.height(),
			left=yunet_face.left() - x0,
			top=yunet_face.top() - y0,
		)
		calls = []

		def detector(gray, upsample):
			calls.append(upsample)
			return [local] if upsample == 0 else []

		buffers = PreallocatedBuffers()
		face1, kind1 = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			buffers,
			bgr=_bgr(),
			yunet=_FakeYunet(faces),
		)
		self.assertEqual(kind1, "hog")
		self.assertGreater(len(calls), 0)
		n_first = len(calls)
		face2, kind2 = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			buffers,
			bgr=_bgr(),
			yunet=_FakeYunet(faces),
			prev_face=face1,
		)
		self.assertIs(face2, face1)
		self.assertEqual(kind2, "hog")
		self.assertEqual(len(calls), n_first)

	def test_moved_yunet_reruns_hog_refine(self):
		faces_a = np.array(
			[[40.0, 30.0, 160.0, 180.0] + [0.0] * 10 + [0.8]],
			dtype=np.float32,
		)
		faces_b = np.array(
			[[220.0, 40.0, 160.0, 180.0] + [0.0] * 10 + [0.8]],
			dtype=np.float32,
		)
		calls = []

		def detector(gray, upsample):
			calls.append(gray.shape)
			h, w = gray.shape[:2]
			return [_FakeFace(w=max(40, w - 8), h=max(40, h - 8), left=4, top=4)]

		buffers = PreallocatedBuffers()
		face1, _kind1 = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			buffers,
			bgr=_bgr(),
			yunet=_FakeYunet(faces_a),
		)
		self.assertIsNotNone(face1)
		n_first = len(calls)
		face2, _kind2 = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			buffers,
			bgr=_bgr(),
			yunet=_FakeYunet(faces_b),
			prev_face=face1,
		)
		self.assertIsNotNone(face2)
		self.assertGreater(len(calls), n_first)

	def test_yunet_miss_uses_hog_upsample(self):
		hit = _FakeFace()
		calls = []

		def detector(gray, upsample):
			calls.append(upsample)
			return [hit] if upsample == 1 else []

		face, kind = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			PreallocatedBuffers(),
			bgr=_bgr(),
			yunet=_FakeYunet(None),
		)
		self.assertIs(face, hit)
		self.assertEqual(kind, "upsample")
		self.assertEqual(calls, [0, 0, 1])

	def test_yunet_micro_falls_through_to_hog(self):
		hit = _FakeFace()

		def detector(gray, upsample):
			return [hit] if upsample == 0 else []

		faces = np.array(
			[[200.0, 140.0, 44.0, 44.0] + [0.0] * 10 + [0.9]],
			dtype=np.float32,
		)
		face, kind = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			PreallocatedBuffers(),
			bgr=_bgr(),
			yunet=_FakeYunet(faces),
		)
		self.assertIs(face, hit)
		self.assertEqual(kind, "hog")

	def test_yunet_exception_falls_back_to_hog(self):
		hit = _FakeFace()

		def detector(gray, upsample):
			return [hit] if upsample == 0 else []

		face, kind = run_face_detect(
			detector,
			_gray(),
			_select_largest,
			PreallocatedBuffers(),
			bgr=_bgr(),
			yunet=_BoomYunet(None),
		)
		self.assertIs(face, hit)
		self.assertEqual(kind, "hog")

	def test_yunet_empty_rows(self):
		self.assertEqual(yunet_faces_to_rects(None, 480, 360), [])
		self.assertEqual(yunet_faces_to_rects([], 480, 360), [])

	def test_real_onnx_loads_if_vendored(self):
		path = get_yunet_path()
		if not os.path.exists(path):
			self.skipTest("YuNet ONNX not vendored")
		detector = load_yunet(path)
		self.assertIsNotNone(detector)

	def test_stabilize_holds_jitter(self):
		prev = _FakeFace(140, 160, left=170, top=80)
		jitter = _FakeFace(140, 160, left=171, top=80)
		held = stabilize_face_rect(prev, jitter)
		self.assertEqual(held.left(), 170)
		self.assertEqual(held.top(), 80)
		self.assertEqual(held.width(), 140)
		self.assertEqual(held.height(), 160)

	def test_stabilize_snaps_on_large_move(self):
		prev = _FakeFace(140, 160, left=170, top=80)
		moved = _FakeFace(140, 160, left=40, top=40)
		snapped = stabilize_face_rect(prev, moved)
		self.assertEqual(snapped.left(), 40)
		self.assertEqual(snapped.top(), 40)

	def test_box_iou_identical_is_one(self):
		box = (10.0, 10.0, 110.0, 110.0)
		self.assertAlmostEqual(box_iou(box, box), 1.0)
		self.assertEqual(box_iou(box, (200.0, 200.0, 220.0, 220.0)), 0.0)

	def test_yunet_box_is_not_inflated_hair_to_neck(self):
		faces = np.array(
			[
				[
					80.0,
					10.0,
					220.0,
					280.0,
					145.0,
					118.0,
					235.0,
					118.0,
					190.0,
					155.0,
					165.0,
					195.0,
					215.0,
					195.0,
					0.92,
				]
			],
			dtype=np.float32,
		)
		rects = yunet_faces_to_rects(faces, 480, 360)
		self.assertEqual(len(rects), 1)
		# 5% pad, not the old 20% that made a giant rectangle for 68-pt.
		self.assertLess(rects[0].height(), 320)
		self.assertGreater(rects[0].height(), 280)

	def test_pad_defaults_are_tight(self):
		from blink_detector_package.infrastructure import vision as vision_mod

		self.assertAlmostEqual(vision_mod.YUNET_PAD_X, 0.05)
		self.assertAlmostEqual(vision_mod.YUNET_PAD_Y, 0.05)


if __name__ == "__main__":
	unittest.main()
