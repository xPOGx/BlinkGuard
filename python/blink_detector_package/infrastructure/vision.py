import base64

import cv2
import numpy as np

# Preview JPEG — keep light; dark rooms + 640 encode were ~halfing loop FPS
# (POG 2026-08-09: target 20 → measured ~10 with send_video).
ENCODE_JPEG_QUALITY = 50
PREVIEW_MAX_WIDTH = 480
ENCODE_PARAMS = [cv2.IMWRITE_JPEG_QUALITY, ENCODE_JPEG_QUALITY]


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


def get_eye_landmarks_only(predictor, gray, face, buffers):
	shape = predictor(gray, face)
	for index in range(6):
		point = shape.part(36 + index)
		buffers.left_eye[index, 0] = point.x
		buffers.left_eye[index, 1] = point.y

		point = shape.part(42 + index)
		buffers.right_eye[index, 0] = point.x
		buffers.right_eye[index, 1] = point.y

	return buffers.left_eye, buffers.right_eye


def get_face_landmarks(predictor, gray, face, buffers):
	"""Fill 68-pt buffer plus eye slices; used for EAR + pose gates."""
	shape = predictor(gray, face)
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
