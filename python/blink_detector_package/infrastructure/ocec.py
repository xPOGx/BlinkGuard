"""OCEC (open/closed eye) confirm via OpenCV DNN — not a landmark backend."""

from __future__ import annotations

import os

import cv2
import numpy as np

from blink_detector_package.infrastructure.models import get_models_dir
from blink_detector_package.infrastructure.vision import (
	crop_eye_bgr,
	get_ocec_enabled,
)

OCEC_FILENAME = "ocec_s.onnx"
# S/N train at 24×40 (H×W). blobFromImage size is (width, height).
OCEC_INPUT_WH = (40, 24)


def get_ocec_path(model_path=None):
	if model_path is not None:
		return model_path
	return os.path.join(get_models_dir(), OCEC_FILENAME)


class OcecNet:
	"""Thin cv2.dnn wrapper. `score(crop_bgr)` → prob_open in [0, 1] or None."""

	def __init__(self, net, input_wh=OCEC_INPUT_WH):
		self._net = net
		self.input_wh = (int(input_wh[0]), int(input_wh[1]))

	def score(self, crop_bgr):
		if crop_bgr is None or getattr(crop_bgr, "size", 0) == 0:
			return None
		image = crop_bgr
		if image.ndim == 2:
			image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
		elif image.ndim != 3 or image.shape[2] < 3:
			return None
		try:
			rgb = image[:, :, :3]
			blob = cv2.dnn.blobFromImage(
				rgb,
				scalefactor=1.0 / 255.0,
				size=self.input_wh,
				mean=(0.0, 0.0, 0.0),
				swapRB=True,
				crop=False,
			)
			self._net.setInput(blob)
			out = self._net.forward()
			prob = float(np.squeeze(out))
		except Exception:
			return None
		if not np.isfinite(prob):
			return None
		return float(min(1.0, max(0.0, prob)))


def load_ocec(model_path=None):
	"""OpenCV DNN net for OCEC, or None if the ONNX is missing / unusable."""
	path = get_ocec_path(model_path)
	if not path or not os.path.exists(path):
		return None
	read = getattr(cv2.dnn, "readNetFromONNX", None)
	if read is None:
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
		net = read(path)
		if net is None or net.empty():
			return None
		try:
			net.setPreferableBackend(int(backend))
			net.setPreferableTarget(int(target))
		except Exception:
			pass
		return OcecNet(net, OCEC_INPUT_WH)
	except Exception:
		return None
	finally:
		if prev_log is not None:
			try:
				cv2.utils.logging.setLogLevel(prev_log)
			except Exception:
				pass


def score_eye_open(net, image, eye_pts):
	"""
	prob_open for one 6-pt eye, or None when disabled / unusable.

	`image` is BGR (preferred) or grayscale. Does not run when OCEC_ENABLED
	is false or `net` is missing — FSM then skips confirm (legacy traces).
	"""
	if not get_ocec_enabled() or net is None:
		return None
	crop = crop_eye_bgr(image, eye_pts)
	if crop is None:
		return None
	return net.score(crop)
