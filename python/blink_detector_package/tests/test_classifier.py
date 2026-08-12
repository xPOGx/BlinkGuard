"""Stage 4 logistic credit-vote unit tests — no camera."""

from __future__ import annotations

import unittest

from blink_detector_package.domain.classifier import (
	CLASSIFIER_ENABLED,
	CLASSIFIER_RESCUE,
	FEATURE_NAMES,
	clear_personal,
	features_from_info,
	personal_overlay,
	score,
	set_personal,
	sigmoid,
)


def _passthrough_weights(**overrides):
	payload = {
		"mean": [0.0] * len(FEATURE_NAMES),
		"std": [1.0] * len(FEATURE_NAMES),
		"weights": [0.0] * len(FEATURE_NAMES),
		"bias": 0.0,
		"threshold": 0.5,
	}
	payload.update(overrides)
	return payload


def _sample_info():
	return {
		"drop": 0.40,
		"duration": 0.12,
		"closed_frames": 2,
		"absolute_drop": 0.08,
		"peak_velocity_raw": 1.0,
		"peak_opening_velocity": 0.40,
		"pose_delta": 0.01,
		"yaw": 0.10,
		"pose_weight": 0.0,
		"ear_depressed": False,
		"left_drop": 0.40,
		"right_drop": 0.38,
		"aperture_drop": 0.30,
		"merge": "both",
	}


class ClassifierScoreTests(unittest.TestCase):
	def setUp(self):
		clear_personal()

	def tearDown(self):
		clear_personal()
	def test_feature_vector_length(self):
		vector = features_from_info(_sample_info())
		self.assertEqual(len(vector), len(FEATURE_NAMES))
		self.assertEqual(vector[FEATURE_NAMES.index("merge_both")], 1.0)
		self.assertEqual(vector[FEATURE_NAMES.index("merge_stronger")], 0.0)
		self.assertEqual(vector[FEATURE_NAMES.index("aperture_missing")], 0.0)

	def test_aperture_missing_flag(self):
		info = _sample_info()
		info["aperture_drop"] = None
		vector = features_from_info(info)
		self.assertEqual(vector[FEATURE_NAMES.index("aperture_drop")], 0.0)
		self.assertEqual(vector[FEATURE_NAMES.index("aperture_missing")], 1.0)

	def test_known_vector_stable_p(self):
		p, veto = score(
			_sample_info(),
			weights=_passthrough_weights(bias=0.0),
			enabled=True,
		)
		self.assertIsNotNone(p)
		self.assertAlmostEqual(p, 0.5, places=5)
		self.assertFalse(veto)
		p2, _ = score(
			_sample_info(),
			weights=_passthrough_weights(bias=0.0),
			enabled=True,
		)
		self.assertEqual(p, p2)

	def test_low_p_vetoes(self):
		p, veto = score(
			_sample_info(),
			weights=_passthrough_weights(bias=-4.0, threshold=0.5),
			enabled=True,
		)
		self.assertLess(p, 0.05)
		self.assertTrue(veto)

	def test_disabled_is_passthrough(self):
		set_personal(1.5, 0.20)
		p, veto = score(
			_sample_info(),
			weights=_passthrough_weights(bias=-4.0),
			enabled=False,
		)
		self.assertIsNone(p)
		self.assertFalse(veto)

	def test_sigmoid_bounds(self):
		self.assertAlmostEqual(sigmoid(0.0), 0.5, places=6)
		self.assertGreater(sigmoid(4.0), 0.95)
		self.assertEqual(sigmoid(80.0), 1.0)
		self.assertEqual(sigmoid(-80.0), 0.0)

	def test_rescue_flag_off(self):
		self.assertTrue(CLASSIFIER_ENABLED)
		self.assertFalse(CLASSIFIER_RESCUE)

	def test_side_yaw_does_not_veto(self):
		info = _sample_info()
		info["yaw"] = 0.85
		p, veto = score(
			info,
			weights=_passthrough_weights(bias=-4.0, threshold=0.5),
			enabled=True,
		)
		self.assertLess(p, 0.05)
		self.assertFalse(veto)

	def test_frontal_low_p_still_vetoes(self):
		info = _sample_info()
		info["yaw"] = 0.10
		_p, veto = score(
			info,
			weights=_passthrough_weights(bias=-4.0, threshold=0.5),
			enabled=True,
		)
		self.assertTrue(veto)

	def test_personal_bias_raises_p(self):
		weights = _passthrough_weights(bias=0.0, threshold=0.5)
		p0, _ = score(_sample_info(), weights=weights, enabled=True)
		set_personal(1.5, None)
		p1, _ = score(_sample_info(), weights=weights, enabled=True)
		self.assertGreater(p1, p0)

	def test_personal_threshold_overrides_baked(self):
		set_personal(0.0, 0.20)
		p, veto = score(
			_sample_info(),
			weights=_passthrough_weights(bias=0.0, threshold=0.5),
			enabled=True,
		)
		self.assertAlmostEqual(p, 0.5, places=5)
		self.assertFalse(veto)

	def test_clear_personal(self):
		set_personal(1.2, 0.20)
		clear_personal()
		p, veto = score(
			_sample_info(),
			weights=_passthrough_weights(bias=-4.0, threshold=0.5),
			enabled=True,
		)
		self.assertLess(p, 0.05)
		self.assertTrue(veto)

	def test_stdin_null_clears_personal(self):
		from blink_detector_package.application.detector import (
			BlinkDetectorApplication,
		)

		class _Transport:
			def __init__(self):
				self.messages = []

			def send(self, msg):
				self.messages.append(msg)

		set_personal(1.2, 0.20)
		harness = type("Harness", (), {"transport": _Transport()})()
		BlinkDetectorApplication._apply_config_dict(
			harness, {"classifier_calibration": None}
		)
		overlay = personal_overlay()
		self.assertEqual(overlay["bias"], 0.0)
		self.assertIsNone(overlay["threshold"])


if __name__ == "__main__":
	unittest.main()
