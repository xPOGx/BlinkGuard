import base64

import cv2
import numpy as np

# Preview JPEG — keep light; dark rooms + 640 encode were ~halfing loop FPS
# (POG 2026-08-09: target 20 → measured ~10 with send_video).
ENCODE_JPEG_QUALITY = 50
PREVIEW_MAX_WIDTH = 480
ENCODE_PARAMS = [cv2.IMWRITE_JPEG_QUALITY, ENCODE_JPEG_QUALITY]

# L2-A: local CLAHE before shape_predictor (default HOG path stays raw gray).
# Parked off: eye-ROI chase shook dots; face-rect still hurt Phase 0 when the
# face patch was darker than the room (POG 2026-08-09 start_to_complete≈0.32).
# Keep helpers for a future dark-only A/B — do not enable with gate retunes.
CLAHE_ENABLED = False
CLAHE_CLIP_LIMIT = 1.5
CLAHE_TILE_SIZE = (8, 8)
FACE_ROI_PAD_RATIO = 0.05
CLAHE_MAX_FACE_LUMA = 55.0
CLAHE_BLEND = 0.35

# Miss-only full-frame CLAHE for HOG retry (side light / Fifine face_none).
# Separate from landmark CLAHE_ENABLED — never applied to shape_predictor here.
HOG_DETECT_CLAHE_CLIP = 2.0
HOG_DETECT_CLAHE_TILE = (8, 8)


class PreallocatedBuffers:
	def __init__(self, max_points=68):
		self.landmarks_array = np.zeros((max_points, 2), dtype=np.int32)
		self.left_eye = np.zeros((6, 2), dtype=np.int32)
		self.right_eye = np.zeros((6, 2), dtype=np.int32)
		self.temp_frame = None
		self.ear_diffs = np.zeros((3, 2), dtype=np.float32)
		self.ear_distances = np.zeros(3, dtype=np.float32)
		self.concatenated_eyes = np.zeros((12, 2), dtype=np.int32)
		self.normalized_landmarks = [
			{"x": 0.0, "y": 0.0} for _ in range(12)
		]
		self.clahe_roi_count = 0
		self._clahe = None
		self._hog_detect_clahe = None

	def clahe(self):
		if self._clahe is None:
			self._clahe = cv2.createCLAHE(
				clipLimit=CLAHE_CLIP_LIMIT,
				tileGridSize=CLAHE_TILE_SIZE,
			)
		return self._clahe

	def hog_detect_clahe(self):
		"""Milder full-frame CLAHE used only on HOG miss retry."""
		if self._hog_detect_clahe is None:
			self._hog_detect_clahe = cv2.createCLAHE(
				clipLimit=HOG_DETECT_CLAHE_CLIP,
				tileGridSize=HOG_DETECT_CLAHE_TILE,
			)
		return self._hog_detect_clahe


def _clamp_roi(x0, y0, x1, y1, width, height):
	x0 = max(0, min(int(x0), width - 1))
	y0 = max(0, min(int(y0), height - 1))
	x1 = max(x0 + 1, min(int(x1), width))
	y1 = max(y0 + 1, min(int(y1), height))
	return x0, y0, x1, y1


def roi_from_face(face, frame_shape, pad_ratio=FACE_ROI_PAD_RATIO):
	"""Padded face rect — stable ROI from HOG (not landmark-chasing)."""
	if face is None:
		return None
	height, width = frame_shape[:2]
	pad_x = face.width() * pad_ratio
	pad_y = face.height() * pad_ratio
	return _clamp_roi(
		face.left() - pad_x,
		face.top() - pad_y,
		face.right() + pad_x,
		face.bottom() + pad_y,
		width,
		height,
	)


def _ensure_temp_gray(buffers, gray):
	"""Copy gray into buffers.temp_frame (reuse allocation when shape matches)."""
	if (
		buffers.temp_frame is None
		or buffers.temp_frame.shape != gray.shape
		or buffers.temp_frame.dtype != gray.dtype
	):
		buffers.temp_frame = np.empty_like(gray)
	np.copyto(buffers.temp_frame, gray)
	return buffers.temp_frame


def apply_clahe_roi_blended(gray_out, gray_src, roi, clahe, blend=CLAHE_BLEND):
	"""CLAHE face patch, blend with raw, paste into gray_out. Returns 1 or 0."""
	if roi is None:
		return 0
	x0, y0, x1, y1 = roi
	patch = gray_src[y0:y1, x0:x1]
	if patch.size < 64:
		return 0
	enhanced = clahe.apply(patch)
	alpha = max(0.0, min(1.0, float(blend)))
	if alpha >= 1.0 - 1e-6:
		gray_out[y0:y1, x0:x1] = enhanced
	elif alpha <= 1e-6:
		return 0
	else:
		mixed = cv2.addWeighted(enhanced, alpha, patch, 1.0 - alpha, 0.0)
		gray_out[y0:y1, x0:x1] = mixed
	return 1


def prepare_hog_detect_gray(gray, buffers):
	"""
	Full-frame mild CLAHE for HOG miss retry only.

	Returns enhanced gray (buffers.temp_frame) or None if gray is unusable.
	Does not depend on CLAHE_ENABLED (landmark path stays parked).
	"""
	if gray is None or buffers is None:
		return None
	if gray.size < 64:
		return None
	applied = buffers.hog_detect_clahe().apply(gray)
	return _ensure_temp_gray(buffers, applied)


def run_hog_face_detect(detector, gray, select_largest, buffers=None):
	"""
	HOG face detect with miss-only retries.

	Order: raw upsample=0 → full-frame CLAHE upsample=0 → raw upsample=1.
	Returns (face_or_None, retry_kind) where retry_kind is None|"clahe"|"upsample".
	"""
	faces = detector(gray, 0)
	face = select_largest(faces)
	if face is not None:
		return face, None

	enhanced = prepare_hog_detect_gray(gray, buffers)
	if enhanced is not None:
		faces = detector(enhanced, 0)
		face = select_largest(faces)
		if face is not None:
			return face, "clahe"

	faces = detector(gray, 1)
	face = select_largest(faces)
	if face is not None:
		return face, "upsample"
	return None, None


def prepare_predictor_gray(
	gray,
	face,
	buffers,
	prev_left_eye=None,
	prev_right_eye=None,
):
	"""
	Default HOG uses raw gray (+ miss-only retry elsewhere); predictor may get
	a dark-gated face CLAHE copy when CLAHE_ENABLED.

	prev_* eyes ignored (kept for call-site compat) — eye-ROI CLAHE caused
	landmark feedback shake and bright-room FP credits.
	"""
	del prev_left_eye, prev_right_eye
	buffers.clahe_roi_count = 0
	if gray is None or face is None or not CLAHE_ENABLED:
		return gray, 0

	face_roi = roi_from_face(face, gray.shape)
	if face_roi is None:
		return gray, 0

	x0, y0, x1, y1 = face_roi
	face_patch = gray[y0:y1, x0:x1]
	if face_patch.size < 64:
		return gray, 0
	face_luma = float(np.mean(face_patch))
	if face_luma >= CLAHE_MAX_FACE_LUMA:
		# Bright enough — raw gray is stabler for 68-pt + EAR.
		return gray, 0

	enhanced = _ensure_temp_gray(buffers, gray)
	count = apply_clahe_roi_blended(
		enhanced,
		gray,
		face_roi,
		buffers.clahe(),
		blend=CLAHE_BLEND,
	)
	buffers.clahe_roi_count = count
	return enhanced, count


def get_eye_landmarks_only(
	predictor,
	gray,
	face,
	buffers,
	prev_left_eye=None,
	prev_right_eye=None,
):
	gray_pred, _count = prepare_predictor_gray(
		gray,
		face,
		buffers,
		prev_left_eye=prev_left_eye,
		prev_right_eye=prev_right_eye,
	)
	shape = predictor(gray_pred, face)
	for index in range(6):
		point = shape.part(36 + index)
		buffers.left_eye[index, 0] = point.x
		buffers.left_eye[index, 1] = point.y

		point = shape.part(42 + index)
		buffers.right_eye[index, 0] = point.x
		buffers.right_eye[index, 1] = point.y

	return buffers.left_eye, buffers.right_eye


def get_face_landmarks(
	predictor,
	gray,
	face,
	buffers,
	prev_left_eye=None,
	prev_right_eye=None,
):
	"""Fill 68-pt buffer plus eye slices; used for EAR + pose gates."""
	gray_pred, _count = prepare_predictor_gray(
		gray,
		face,
		buffers,
		prev_left_eye=prev_left_eye,
		prev_right_eye=prev_right_eye,
	)
	shape = predictor(gray_pred, face)
	for index in range(68):
		point = shape.part(index)
		buffers.landmarks_array[index, 0] = point.x
		buffers.landmarks_array[index, 1] = point.y

	buffers.left_eye[:, :] = buffers.landmarks_array[36:42]
	buffers.right_eye[:, :] = buffers.landmarks_array[42:48]
	return buffers.landmarks_array, buffers.left_eye, buffers.right_eye


def prepare_preview_frame(frame, max_width=PREVIEW_MAX_WIDTH):
	"""Downscale wide frames before JPEG so preview encode stays cheap."""
	if frame is None or max_width is None or max_width <= 0:
		return frame
	height, width = frame.shape[:2]
	if width <= max_width:
		return frame
	scale = max_width / float(width)
	new_size = (max_width, max(1, int(round(height * scale))))
	return cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)


def encode_frame(frame, max_width=PREVIEW_MAX_WIDTH, quality=None):
	preview = prepare_preview_frame(frame, max_width=max_width)
	params = ENCODE_PARAMS
	if quality is not None:
		params = [cv2.IMWRITE_JPEG_QUALITY, int(quality)]
	_, buffer = cv2.imencode(".jpg", preview, params)
	return base64.b64encode(buffer).decode("utf-8")
