import base64

import cv2
import dlib
import numpy as np

from blink_detector_package.domain.pose import face_bbox_plausible

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
# dlib HOG default is 0.0; weak scores are almost always clutter FPs
# (laundry, fabric) once the real face is gone. Side-light misses still
# retry via CLAHE/upsample — this only drops low-confidence hits.
HOG_MIN_SCORE = 0.30

# Stage 3.1: upscale padded face ROI before shape_predictor for sub-pixel EAR.
# 1 = disabled (integer path); 2 = default; 3 only if FPS budget allows.
LANDMARK_ROI_UPSCALE = 2
LANDMARK_ROI_PAD_RATIO = 0.08

# Stage 3.5: intensity aperture as 2nd closedness channel (confirm on credit).
# False → callers get None (3.4 FSM-only behaviour).
INTENSITY_APERTURE_ENABLED = True
APERTURE_MIN_CROP_W = 8
APERTURE_MIN_CROP_H = 6
APERTURE_PAD_RATIO = 0.20
APERTURE_SCANLINES = 5
APERTURE_X_LO = 0.15
APERTURE_X_HI = 0.85


def get_landmark_roi_upscale() -> int:
	return int(LANDMARK_ROI_UPSCALE)


def set_landmark_roi_upscale(scale: int) -> int:
	"""Set ROI upscale factor (≥1). Returns the applied value."""
	global LANDMARK_ROI_UPSCALE
	try:
		value = int(scale)
	except (TypeError, ValueError):
		value = 1
	LANDMARK_ROI_UPSCALE = max(1, value)
	return LANDMARK_ROI_UPSCALE


def get_intensity_aperture_enabled() -> bool:
	return bool(INTENSITY_APERTURE_ENABLED)


def set_intensity_aperture_enabled(enabled: bool) -> bool:
	"""Enable/disable Stage 3.5 aperture. Returns applied value."""
	global INTENSITY_APERTURE_ENABLED
	INTENSITY_APERTURE_ENABLED = bool(enabled)
	return INTENSITY_APERTURE_ENABLED


def eye_intensity_aperture(gray, eye_pts):
	"""
	Lid aperture from vertical intensity gradients in a 6-pt eye crop.

	Returns mean open height / eye_width (EAR-like scale), or None when the
	crop is unusable / feature disabled. Does not use mean-luma (look-down
	darkens iris without blinking).
	"""
	if not INTENSITY_APERTURE_ENABLED:
		return None
	if gray is None or eye_pts is None:
		return None
	pts = np.asarray(eye_pts, dtype=np.float64)
	if pts.shape != (6, 2):
		return None

	xs = pts[:, 0]
	ys = pts[:, 1]
	eye_width = float(xs.max() - xs.min())
	if eye_width < 4.0:
		return None

	pad = eye_width * APERTURE_PAD_RATIO
	x0 = int(np.floor(xs.min() - pad))
	y0 = int(np.floor(ys.min() - pad))
	x1 = int(np.ceil(xs.max() + pad))
	y1 = int(np.ceil(ys.max() + pad))
	h_img, w_img = gray.shape[:2]
	x0, y0, x1, y1 = _clamp_roi(x0, y0, x1, y1, w_img, h_img)
	crop_w = x1 - x0
	crop_h = y1 - y0
	if crop_w < APERTURE_MIN_CROP_W or crop_h < APERTURE_MIN_CROP_H:
		return None

	# dlib eye order: 0 outer, 1–2 upper, 3 inner, 4–5 lower (inner→outer).
	outer = pts[0]
	inner = pts[3]
	upper_a, upper_b = pts[1], pts[2]
	lower_a, lower_b = pts[5], pts[4]

	heights: list[float] = []
	n = max(2, int(APERTURE_SCANLINES))
	for i in range(n):
		u = APERTURE_X_LO + (APERTURE_X_HI - APERTURE_X_LO) * (
			i / (n - 1)
		)
		px = outer[0] + u * (inner[0] - outer[0])
		py_u = upper_a[1] + u * (upper_b[1] - upper_a[1])
		py_l = lower_a[1] + u * (lower_b[1] - lower_a[1])
		if py_l <= py_u + 1.0:
			heights.append(0.0)
			continue

		cx = int(round(px))
		if cx < x0 or cx >= x1:
			continue
		# Search a little outside landmark lids for intensity edges.
		margin = max(1.0, 0.15 * (py_l - py_u))
		yt = int(np.floor(py_u - margin))
		yb = int(np.ceil(py_l + margin))
		yt = max(y0, min(yt, y1 - 2))
		yb = max(yt + 2, min(yb, y1))
		col = gray[yt:yb, cx].astype(np.float64)
		if col.size < 3:
			continue
		grad = np.abs(np.gradient(col))
		n_band = max(1, col.size // 3)
		top_i = int(np.argmax(grad[: max(n_band, 1)]))
		bot_slice = grad[-n_band:]
		bot_i = col.size - n_band + int(np.argmax(bot_slice))
		if bot_i <= top_i:
			# Closed / flat: fall back to landmark span (often ~0–2 px).
			heights.append(max(0.0, py_l - py_u))
			continue
		heights.append(float(bot_i - top_i))

	if not heights:
		return None
	return float(sum(heights) / len(heights)) / eye_width


class PreallocatedBuffers:
	def __init__(self, max_points=68):
		# float32 so Stage-3 ROI upscale can keep sub-pixel landmark coords.
		self.landmarks_array = np.zeros((max_points, 2), dtype=np.float32)
		self.left_eye = np.zeros((6, 2), dtype=np.float32)
		self.right_eye = np.zeros((6, 2), dtype=np.float32)
		self.temp_frame = None
		self.ear_diffs = np.zeros((3, 2), dtype=np.float32)
		self.ear_distances = np.zeros(3, dtype=np.float32)
		self.concatenated_eyes = np.zeros((12, 2), dtype=np.float32)
		self.normalized_landmarks = [
			{"x": 0.0, "y": 0.0} for _ in range(12)
		]
		self.clahe_roi_count = 0
		self._clahe = None
		self._hog_detect_clahe = None
		self._upscale_patch = None

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


def hog_detect_rects(detector, gray, upsample, min_score=HOG_MIN_SCORE):
	"""
	Run HOG and drop weak scores when detector.run is available.

	Callables without .run (unit fakes) keep every rectangle.
	"""
	run = getattr(detector, "run", None)
	if callable(run):
		try:
			result = run(gray, upsample, 0.0)
		except TypeError:
			result = None
		if result is not None and len(result) >= 2:
			rects, scores = result[0], result[1]
			kept = []
			for rect, score in zip(rects, scores):
				try:
					if float(score) >= min_score:
						kept.append(rect)
				except (TypeError, ValueError):
					kept.append(rect)
			return kept
	faces = detector(gray, upsample)
	if not faces:
		return []
	return list(faces)


def _select_plausible_face(faces, gray, select_largest):
	if gray is None or gray.size == 0:
		return select_largest(faces)
	height, width = gray.shape[:2]
	kept = [face for face in faces if face_bbox_plausible(face, width, height)]
	return select_largest(kept)


def run_hog_face_detect(detector, gray, select_largest, buffers=None):
	"""
	HOG face detect with miss-only retries.

	Order: raw upsample=0 → full-frame CLAHE upsample=0 → raw upsample=1.
	Drops weak HOG scores and small edge-glued boxes (clutter FPs).
	Returns (face_or_None, retry_kind) where retry_kind is None|"clahe"|"upsample".
	"""
	faces = hog_detect_rects(detector, gray, 0)
	face = _select_plausible_face(faces, gray, select_largest)
	if face is not None:
		return face, None

	enhanced = prepare_hog_detect_gray(gray, buffers)
	if enhanced is not None:
		faces = hog_detect_rects(detector, enhanced, 0)
		face = _select_plausible_face(faces, gray, select_largest)
		if face is not None:
			return face, "clahe"

	faces = hog_detect_rects(detector, gray, 1)
	face = _select_plausible_face(faces, gray, select_largest)
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


def _face_rect_in_roi(face, x0, y0, x1, y1, scale):
	"""Map full-frame dlib face rect into an upscaled ROI image."""
	left = int(round((face.left() - x0) * scale))
	top = int(round((face.top() - y0) * scale))
	right = int(round((face.right() - x0) * scale))
	bottom = int(round((face.bottom() - y0) * scale))
	width = max(1, (x1 - x0) * scale)
	height = max(1, (y1 - y0) * scale)
	left = max(0, min(left, width - 2))
	top = max(0, min(top, height - 2))
	right = max(left + 1, min(right, width - 1))
	bottom = max(top + 1, min(bottom, height - 1))
	return dlib.rectangle(left, top, right, bottom)


def _predict_shape_on_gray(predictor, gray_pred, face, buffers, upscale):
	"""
	Run shape_predictor; optionally on an upscaled face ROI.

	Returns (shape, x0, y0, scale) for mapping parts back to frame coords.
	"""
	scale = max(1, int(upscale))
	if scale <= 1:
		return predictor(gray_pred, face), 0.0, 0.0, 1.0

	roi = roi_from_face(face, gray_pred.shape, pad_ratio=LANDMARK_ROI_PAD_RATIO)
	if roi is None:
		return predictor(gray_pred, face), 0.0, 0.0, 1.0

	x0, y0, x1, y1 = roi
	patch = gray_pred[y0:y1, x0:x1]
	if patch.size < 64:
		return predictor(gray_pred, face), 0.0, 0.0, 1.0

	up_w = max(1, int(round((x1 - x0) * scale)))
	up_h = max(1, int(round((y1 - y0) * scale)))
	upscaled = cv2.resize(
		patch,
		(up_w, up_h),
		interpolation=cv2.INTER_CUBIC,
	)
	buffers._upscale_patch = upscaled
	face_roi = _face_rect_in_roi(face, x0, y0, x1, y1, scale)
	shape = predictor(upscaled, face_roi)
	return shape, float(x0), float(y0), float(scale)


def _fill_landmarks_from_shape(shape, buffers, x0, y0, scale, eye_only=False):
	"""Write shape parts into buffers (frame coords, float)."""
	inv = 1.0 / scale
	if eye_only:
		for index in range(6):
			point = shape.part(36 + index)
			buffers.left_eye[index, 0] = point.x * inv + x0
			buffers.left_eye[index, 1] = point.y * inv + y0
			point = shape.part(42 + index)
			buffers.right_eye[index, 0] = point.x * inv + x0
			buffers.right_eye[index, 1] = point.y * inv + y0
		return

	for index in range(68):
		point = shape.part(index)
		buffers.landmarks_array[index, 0] = point.x * inv + x0
		buffers.landmarks_array[index, 1] = point.y * inv + y0
	buffers.left_eye[:, :] = buffers.landmarks_array[36:42]
	buffers.right_eye[:, :] = buffers.landmarks_array[42:48]


def get_eye_landmarks_only(
	predictor,
	gray,
	face,
	buffers,
	prev_left_eye=None,
	prev_right_eye=None,
	upscale=None,
):
	gray_pred, _count = prepare_predictor_gray(
		gray,
		face,
		buffers,
		prev_left_eye=prev_left_eye,
		prev_right_eye=prev_right_eye,
	)
	scale = get_landmark_roi_upscale() if upscale is None else max(1, int(upscale))
	shape, x0, y0, used_scale = _predict_shape_on_gray(
		predictor, gray_pred, face, buffers, scale
	)
	_fill_landmarks_from_shape(
		shape, buffers, x0, y0, used_scale, eye_only=True
	)
	return buffers.left_eye, buffers.right_eye


def get_face_landmarks(
	predictor,
	gray,
	face,
	buffers,
	prev_left_eye=None,
	prev_right_eye=None,
	upscale=None,
):
	"""Fill 68-pt buffer plus eye slices; used for EAR + pose gates."""
	gray_pred, _count = prepare_predictor_gray(
		gray,
		face,
		buffers,
		prev_left_eye=prev_left_eye,
		prev_right_eye=prev_right_eye,
	)
	scale = get_landmark_roi_upscale() if upscale is None else max(1, int(upscale))
	shape, x0, y0, used_scale = _predict_shape_on_gray(
		predictor, gray_pred, face, buffers, scale
	)
	_fill_landmarks_from_shape(shape, buffers, x0, y0, used_scale)
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
