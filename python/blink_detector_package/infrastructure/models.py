import os
import sys

import cv2
import dlib

YUNET_FILENAME = "face_detection_yunet_2023mar.onnx"
PREDICTOR_FILENAME = "shape_predictor_68_face_landmarks.dat"

# OpenCV FaceDetectorYN defaults to 0.9 — too strict for webcam side light.
YUNET_SCORE_THRESHOLD = 0.6
YUNET_NMS_THRESHOLD = 0.3
YUNET_TOP_K = 5000
_YUNET_CREATE_SIZE = (320, 320)


def get_models_dir():
	if getattr(sys, "frozen", False):
		return os.path.join(sys._MEIPASS, "assets", "models")
	app_root = os.path.dirname(
		os.path.dirname(
			os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
		)
	)
	return os.path.join(app_root, "electron", "assets", "models")


def get_predictor_path():
	return os.path.join(get_models_dir(), PREDICTOR_FILENAME)


def get_yunet_path():
	return os.path.join(get_models_dir(), YUNET_FILENAME)


def load_yunet(model_path=None):
	"""OpenCV YuNet detector, or None if the ONNX is missing / unusable."""
	path = model_path if model_path is not None else get_yunet_path()
	if not path or not os.path.exists(path):
		return None
	create = getattr(cv2, "FaceDetectorYN", None)
	if create is None or not hasattr(create, "create"):
		return None
	backend = getattr(cv2.dnn, "DNN_BACKEND_OPENCV", 3)
	target = getattr(cv2.dnn, "DNN_TARGET_CPU", 0)
	prev_log = None
	try:
		log_mod = cv2.utils.logging
		prev_log = log_mod.getLogLevel()
		log_mod.setLogLevel(log_mod.LOG_LEVEL_ERROR)
	except Exception:
		prev_log = None
	try:
		return create.create(
			path,
			"",
			_YUNET_CREATE_SIZE,
			YUNET_SCORE_THRESHOLD,
			YUNET_NMS_THRESHOLD,
			YUNET_TOP_K,
			int(backend),
			int(target),
		)
	except TypeError:
		try:
			return create.create(
				path,
				"",
				_YUNET_CREATE_SIZE,
				YUNET_SCORE_THRESHOLD,
				YUNET_NMS_THRESHOLD,
				YUNET_TOP_K,
			)
		except Exception:
			return None
	except Exception:
		return None
	finally:
		if prev_log is not None:
			try:
				cv2.utils.logging.setLogLevel(prev_log)
			except Exception:
				pass


def load_models():
	detector = dlib.get_frontal_face_detector()
	predictor_path = get_predictor_path()
	yunet = load_yunet()
	if not os.path.exists(predictor_path):
		return detector, None, predictor_path, yunet

	predictor = dlib.shape_predictor(predictor_path)
	return detector, predictor, predictor_path, yunet
