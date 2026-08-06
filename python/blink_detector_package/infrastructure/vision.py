import base64

import cv2
import numpy as np

ENCODE_PARAMS = [cv2.IMWRITE_JPEG_QUALITY, 70]


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


def encode_frame(frame):
    _, buffer = cv2.imencode(".jpg", frame, ENCODE_PARAMS)
    return base64.b64encode(buffer).decode("utf-8")
