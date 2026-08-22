"""Stage 4 — logistic credit vote (numpy-free inference).

Second voice after FSM gates. Missing/disabled weights → pass-through.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

CLASSIFIER_ENABLED = True
CLASSIFIER_RESCUE = False
# Crop/veto band (OCEC confirm skip + logistic). Not the FSM short+shallow
# opening kill (`SIDE_GLANCE_OPENING_KILL_YAW` 0.80). Logistic learned
# "yaw = FP" from the Stage-3.4 side-monitor storm and vetoed real side
# blinks; gates already own that policy. Still score p for blinkDebug.
CLASSIFIER_SIDE_YAW_WAIVE = 0.35

FEATURE_NAMES = (
	"drop",
	"duration",
	"closed_frames",
	"absolute_drop",
	"peak_velocity_raw",
	"peak_opening_velocity",
	"pose_delta",
	"abs_yaw",
	"pose_weight",
	"ear_depressed",
	"left_drop",
	"right_drop",
	"aperture_drop",
	"aperture_missing",
	"merge_both",
	"merge_stronger",
	"merge_single",
	"ocec_drop",
	"ocec_missing",
)

def _default_weights_path() -> Path:
	here = Path(__file__).resolve().parent / "classifier_weights.json"
	if here.exists():
		return here
	meipass = getattr(sys, "_MEIPASS", None)
	if meipass:
		frozen = (
			Path(meipass)
			/ "blink_detector_package"
			/ "domain"
			/ "classifier_weights.json"
		)
		if frozen.exists():
			return frozen
	return here


_WEIGHTS_PATH = _default_weights_path()
_cached: dict[str, Any] | None = None
PERSONAL_BIAS_MIN = -2.0
PERSONAL_BIAS_MAX = 2.0
PERSONAL_THRESHOLD_MIN = 0.15
PERSONAL_THRESHOLD_MAX = 0.30
_personal_bias = 0.0
_personal_threshold: float | None = None


def _f(value: Any, default: float = 0.0) -> float:
	if value is None:
		return default
	try:
		return float(value)
	except (TypeError, ValueError):
		return default


def features_from_info(info: dict[str, Any] | None) -> list[float]:
	"""Build the fixed-order feature vector from a candidate info dict."""
	info = info or {}
	merge = str(info.get("merge") or "single")
	aperture = info.get("aperture_drop")
	aperture_missing = 1.0 if aperture is None else 0.0
	ocec = info.get("ocec_drop")
	ocec_missing = 1.0 if ocec is None else 0.0
	return [
		_f(info.get("drop")),
		_f(info.get("duration")),
		_f(info.get("closed_frames")),
		_f(info.get("absolute_drop")),
		_f(info.get("peak_velocity_raw") or info.get("peak_velocity")),
		_f(info.get("peak_opening_velocity")),
		_f(info.get("pose_delta")),
		abs(_f(info.get("yaw"))),
		_f(info.get("pose_weight")),
		1.0 if info.get("ear_depressed") else 0.0,
		_f(info.get("left_drop")),
		_f(info.get("right_drop")),
		_f(aperture) if aperture is not None else 0.0,
		aperture_missing,
		1.0 if merge == "both" else 0.0,
		1.0 if merge == "stronger" else 0.0,
		1.0 if merge == "single" else 0.0,
		_f(ocec) if ocec is not None else 0.0,
		ocec_missing,
	]


def sigmoid(z: float) -> float:
	if z >= 40.0:
		return 1.0
	if z <= -40.0:
		return 0.0
	return 1.0 / (1.0 + math.exp(-z))


def load_weights(path: Path | None = None) -> dict[str, Any] | None:
	"""Load weights JSON; caches the default package file."""
	global _cached
	target = path or _WEIGHTS_PATH
	if path is None and _cached is not None:
		return _cached
	if not target.exists():
		if path is None:
			_cached = None
		return None
	with target.open(encoding="utf-8") as handle:
		data = json.load(handle)
	if not isinstance(data, dict):
		return None
	if path is None:
		_cached = data
	return data


def set_cached_weights(payload: dict[str, Any] | None) -> None:
	"""Test/train helper — inject weights without touching disk."""
	global _cached
	_cached = payload


def clear_weights_cache() -> None:
	global _cached
	_cached = None


def set_personal(
	bias: float | None = None,
	threshold: float | None = None,
) -> dict[str, float | None]:
	"""Apply or clear Stage-5 personal overlay (bias + optional threshold)."""
	global _personal_bias, _personal_threshold
	if bias is None and threshold is None:
		_personal_bias = 0.0
		_personal_threshold = None
		return {"bias": 0.0, "threshold": None}
	if bias is not None:
		try:
			value = float(bias)
		except (TypeError, ValueError):
			value = 0.0
		_personal_bias = max(PERSONAL_BIAS_MIN, min(PERSONAL_BIAS_MAX, value))
	else:
		_personal_bias = 0.0
	if threshold is None:
		_personal_threshold = None
	else:
		try:
			t = float(threshold)
		except (TypeError, ValueError):
			_personal_threshold = None
		else:
			if t <= 0:
				_personal_threshold = None
			else:
				_personal_threshold = max(
					PERSONAL_THRESHOLD_MIN, min(PERSONAL_THRESHOLD_MAX, t)
				)
	return {"bias": _personal_bias, "threshold": _personal_threshold}


def clear_personal() -> None:
	set_personal(None, None)


def personal_overlay() -> dict[str, float | None]:
	return {"bias": _personal_bias, "threshold": _personal_threshold}


def _normalize(vector: list[float], weights: dict[str, Any]) -> list[float]:
	mean = weights.get("mean") or [0.0] * len(vector)
	std = weights.get("std") or [1.0] * len(vector)
	out: list[float] = []
	for index, value in enumerate(vector):
		m = float(mean[index]) if index < len(mean) else 0.0
		s = float(std[index]) if index < len(std) else 1.0
		if s < 1e-8:
			s = 1.0
		out.append((value - m) / s)
	return out


def score(
	info: dict[str, Any] | None,
	*,
	weights: dict[str, Any] | None = None,
	enabled: bool | None = None,
) -> tuple[float | None, bool]:
	"""
	Return (p, veto).

	veto True → FSM should not credit. Disabled / missing weights → (None, False).
	"""
	use = CLASSIFIER_ENABLED if enabled is None else bool(enabled)
	if not use:
		return None, False
	payload = weights if weights is not None else load_weights()
	if not payload:
		return None, False
	w = payload.get("weights")
	if not isinstance(w, list) or len(w) != len(FEATURE_NAMES):
		return None, False
	names = payload.get("features")
	if isinstance(names, list) and names != list(FEATURE_NAMES):
		return None, False
	vector = _normalize(features_from_info(info), payload)
	z = float(payload.get("bias") or 0.0)
	for weight, value in zip(w, vector):
		z += float(weight) * value
	z += _personal_bias
	p = sigmoid(z)
	if _personal_threshold is not None:
		threshold = float(_personal_threshold)
	else:
		threshold = float(payload.get("threshold") or 0.5)
	if (
		p < threshold
		and abs(_f((info or {}).get("yaw"))) >= CLASSIFIER_SIDE_YAW_WAIVE
	):
		return p, False
	return p, p < threshold
