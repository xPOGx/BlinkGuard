"""Unit tests for Phase 2 EAR harden — no camera required."""

from __future__ import annotations

import unittest

from blink_detector_package.domain.blink_detection import (
	BLINK_MIN_CLOSING_VELOCITY,
	BlinkDetectionState,
	get_adaptive_ear_drop_threshold,
)
from blink_detector_package.domain.pose import (
	estimate_head_pose,
	evaluate_pose_gate,
	select_largest_face,
)


class _FakeFace:
	def __init__(self, width, height):
		self._w = width
		self._h = height

	def width(self):
		return self._w

	def height(self):
		return self._h


def _seed_open_eye(state, ear=0.28, t0=1.0, frames=12, dt=0.1):
	"""Build a stable open-eye baseline."""
	for index in range(frames):
		credited, info = state.detect(ear, t0 + index * dt)
		assert credited is False
	assert state.current_baseline_ear > 0
	return t0 + frames * dt


def _frontal_landmarks(yaw_offset=0.0, pitch_shift=0.0):
	"""
	Synthetic 68-pt cloud. yaw_offset moves nose in X;
	pitch_shift moves nose in Y (negative → look-down / smaller nose_ratio).
	"""
	points = [(0.0, 0.0)] * 68
	# Jaw / chin
	for i in range(17):
		points[i] = (100.0 + i * 10.0, 200.0)
	points[8] = (180.0, 260.0)  # chin

	# Brows
	for i in range(17, 27):
		points[i] = (120.0 + (i - 17) * 8.0, 120.0)

	# Nose bridge → tip
	for i in range(27, 31):
		points[i] = (180.0 + yaw_offset, 140.0 + (i - 27) * 12.0 + pitch_shift)
	points[30] = (180.0 + yaw_offset, 176.0 + pitch_shift)
	for i in range(31, 36):
		points[i] = (160.0 + (i - 31) * 10.0 + yaw_offset, 190.0 + pitch_shift)

	# Left eye 36-41
	left = [(150, 150), (158, 145), (166, 145), (174, 150), (166, 155), (158, 155)]
	for i, (x, y) in enumerate(left):
		points[36 + i] = (float(x), float(y))
	# Right eye 42-47
	right = [(186, 150), (194, 145), (202, 145), (210, 150), (202, 155), (194, 155)]
	for i, (x, y) in enumerate(right):
		points[42 + i] = (float(x), float(y))

	# Mouth
	for i in range(48, 68):
		points[i] = (150.0 + (i - 48) * 3.0, 220.0)

	return points


class PoseTests(unittest.TestCase):
	def test_select_largest_face(self):
		faces = [_FakeFace(40, 40), _FakeFace(100, 80), _FakeFace(50, 50)]
		best = select_largest_face(faces)
		self.assertIs(best, faces[1])
		self.assertIsNone(select_largest_face([]))

	def test_estimate_yaw_and_pitch(self):
		frontal = estimate_head_pose(_frontal_landmarks())
		self.assertTrue(frontal["valid"])
		self.assertAlmostEqual(frontal["yaw"], 0.0, delta=0.15)

		profile = estimate_head_pose(_frontal_landmarks(yaw_offset=40.0))
		self.assertGreater(abs(profile["yaw"]), abs(frontal["yaw"]))

		look_down = estimate_head_pose(_frontal_landmarks(pitch_shift=-30.0))
		self.assertGreater(look_down["pitch"], frontal["pitch"])

	def test_extreme_yaw_blocks_credit(self):
		# yaw_offset=22 → yaw ≈1.22, clearly above normal yaw_extreme 1.10
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=22.0))
		self.assertGreater(abs(pose["yaw"]), 1.15)
		gate = evaluate_pose_gate(pose, "normal")
		self.assertTrue(gate["extreme_yaw"])
		self.assertFalse(gate["allow_credit"])

	def test_moderate_side_yaw_still_allows_credit(self):
		"""Dual-monitor glance must not hard-block (yaw ~0.4–0.55)."""
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=10.0))
		gate = evaluate_pose_gate(pose, "normal")
		self.assertFalse(gate["extreme_yaw"])
		self.assertTrue(gate["allow_credit"])
		self.assertGreater(abs(pose["yaw"]), 0.3)
		self.assertLess(abs(pose["yaw"]), 1.10)

	def test_left_monitor_yaw_still_allows_credit(self):
		"""Left-monitor glances (yaw ≈0.88–1.12) must credit under normal."""
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=18.0))
		self.assertGreater(abs(pose["yaw"]), 0.85)
		self.assertLess(abs(pose["yaw"]), 1.10)
		gate = evaluate_pose_gate(pose, "normal")
		self.assertFalse(gate["extreme_yaw"])
		self.assertTrue(gate["allow_credit"])

	def test_look_down_relaxes_drop_threshold(self):
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		# Absolute pitch alone is not look-down — need resting + delta.
		resting = pose["pitch"] - 0.10
		gate = evaluate_pose_gate(pose, "normal", resting_pitch=resting)
		self.assertTrue(gate["look_down"])
		self.assertLess(gate["threshold_mult"], 1.0)
		self.assertGreaterEqual(gate["velocity_mult"], 1.0)
		self.assertLess(gate["recovery_threshold"], 0.7)
		self.assertTrue(gate["allow_credit"])

	def test_resting_pitch_avoids_false_look_down(self):
		"""Webcam-on-top bias (~pitch 0.2) must not always count as look-down."""
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-30.0))
		gate = evaluate_pose_gate(
			pose,
			"normal",
			resting_pitch=pose["pitch"],
		)
		self.assertFalse(gate["look_down"])
		self.assertAlmostEqual(gate["pitch_delta"], 0.0, places=5)


class BlinkDetectionTests(unittest.TestCase):
	def test_adaptive_threshold_bounds(self):
		low = get_adaptive_ear_drop_threshold(0.15)
		high = get_adaptive_ear_drop_threshold(0.35)
		self.assertGreaterEqual(low, high)
		self.assertAlmostEqual(low, 0.20, places=3)
		self.assertAlmostEqual(high, 0.15, places=3)

	def test_normal_blink_credited(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		# Fast close + recover (~300ms) with high |dEAR/dt|.
		series = [
			(0.22, False),
			(0.14, False),
			(0.12, False),
			(0.24, True),
		]
		credited_any = False
		for ear, expect_complete in series:
			t += 0.1
			credited, info = state.detect(ear, t)
			if expect_complete:
				self.assertTrue(credited, msg=info)
				self.assertEqual(info["phase"], "complete")
				self.assertGreaterEqual(
					info["velocity"],
					BLINK_MIN_CLOSING_VELOCITY,
				)
				credited_any = True
			else:
				self.assertFalse(credited)
		self.assertTrue(credited_any)

	def test_slow_look_down_rejected_by_velocity(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		# Gradual 0.01 EAR / 100ms → closing vel ≈ 0.1 << min.
		credited_any = False
		ear = 0.28
		for _ in range(14):
			ear -= 0.01
			t += 0.1
			credited, info = state.detect(ear, t)
			if credited:
				credited_any = True
		# Recover slowly
		for _ in range(8):
			ear += 0.01
			t += 0.1
			credited, info = state.detect(min(ear, 0.28), t)
			if credited:
				credited_any = True
		self.assertFalse(credited_any)

	def test_baseline_frozen_during_blink(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)

		t += 0.1
		state.detect(0.18, t)  # start (may append this frame once)
		self.assertTrue(state.blink_in_progress)
		frozen_baseline = state.current_baseline_ear
		len_at_start = len(state.baseline_ear_values)

		for ear in (0.12, 0.11, 0.10):
			t += 0.1
			state.detect(ear, t)
			self.assertTrue(state.blink_in_progress)
			self.assertEqual(len(state.baseline_ear_values), len_at_start)
			self.assertAlmostEqual(
				state.current_baseline_ear,
				frozen_baseline,
				places=5,
			)

	def test_cooldown_suppresses_second_blink(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)

		def one_blink(start_t, dt=0.05):
			local_t = start_t
			result = False
			for ear in (0.20, 0.12, 0.11, 0.24):
				local_t += dt
				credited, _ = state.detect(ear, local_t)
				if credited:
					result = True
			return result, local_t

		first, t = one_blink(t)
		self.assertTrue(first)
		# Finish second attempt ~0.12s after first credit (< 0.2s cooldown).
		second, _ = one_blink(t, dt=0.03)
		self.assertFalse(second)

	def test_extreme_yaw_no_credit(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		# yaw_offset=22 → yaw ≈1.22 > normal yaw_extreme 1.10
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=22.0))
		self.assertGreater(abs(pose["yaw"]), 1.15)
		self.assertTrue(evaluate_pose_gate(pose, "normal")["extreme_yaw"])
		credited_any = False
		for ear in (0.20, 0.12, 0.11, 0.24):
			t += 0.1
			credited, info = state.detect(ear, t, pose=pose)
			self.assertFalse(credited)
			self.assertEqual(info["phase"], "skip_yaw")
			if credited:
				credited_any = True
		self.assertFalse(credited_any)

	def test_moderate_side_yaw_blink_credited(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=10.0))
		self.assertFalse(evaluate_pose_gate(pose, "normal")["extreme_yaw"])
		series = [0.20, 0.13, 0.11, 0.24]
		credited_any = False
		for ear in series:
			t += 0.1
			credited, info = state.detect(ear, t, pose=pose)
			if credited:
				credited_any = True
				self.assertEqual(info["phase"], "complete")
		self.assertTrue(credited_any)

	def test_one_frame_duration_at_15fps_credited(self):
		"""POG logs: real blinks often complete in ~67ms (1 frame @15fps)."""
		from blink_detector_package.domain.blink_detection import (
			BLINK_DURATION_MIN,
			SHORT_BLINK_MIN_VELOCITY,
		)

		self.assertLessEqual(BLINK_DURATION_MIN, 0.05)
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		# Fast close (strong velocity) then recover one frame later (~0.067s).
		steps = [
			(0.067, 0.10),
			(0.067, 0.26),
		]
		credited_any = False
		for dt, ear in steps:
			t += dt
			credited, info = state.detect(ear, t)
			if credited:
				credited_any = True
				self.assertGreaterEqual(info["duration"], BLINK_DURATION_MIN)
				self.assertLess(info["duration"], 0.08)
				self.assertGreaterEqual(
					info["peak_velocity"],
					SHORT_BLINK_MIN_VELOCITY,
				)
		self.assertTrue(credited_any)

	def test_short_blink_weak_velocity_rejected(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		# Shallow one-frame flicker — duration ok, velocity below short gate.
		credited_any = False
		for ear in (0.22, 0.25):
			t += 0.067
			credited, info = state.detect(ear, t)
			if credited:
				credited_any = True
			if info and info.get("phase") == "reject_velocity":
				break
		self.assertFalse(credited_any)

	def test_await_reopen_blocks_rapid_second_blink(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		# First blink with clear close spike
		credited_first = False
		for ear in (0.12, 0.10, 0.26):
			t += 0.06
			credited, info = state.detect(ear, t)
			if credited:
				credited_first = True
		self.assertTrue(credited_first)
		self.assertTrue(state.awaiting_reopen)
		# Mid-low (look-down open band was ~0.74; stay clearly below OPEN 0.72)
		t += 0.1
		credited, info = state.detect(0.19, t)  # 0.19/0.28 ≈ 0.68
		self.assertFalse(credited)
		self.assertEqual(info["phase"], "skip_await_open")
		# Look-down "open" (~0.74 of baseline) must clear await.
		t += 0.1
		state.detect(0.21, t)  # 0.21/0.28 = 0.75 >= 0.72
		self.assertFalse(state.awaiting_reopen)

	def test_await_reopen_expires(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		state.awaiting_reopen = True
		state.awaiting_reopen_since = t
		t += 0.5
		state._update_eyes_closed_state(0.18, t)  # still mid-low
		self.assertFalse(state.awaiting_reopen)

	def test_sustained_low_ear_marks_eyes_closed(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		state.blink_in_progress = False
		state._low_ear_since = t - 0.2
		state._update_eyes_closed_state(0.13, t)  # 0.13/0.28 ≈ 0.46 < 0.52
		self.assertTrue(state.eyes_closed)
		credited, info = state.detect(0.13, t + 0.05)
		self.assertFalse(credited)
		self.assertEqual(info["phase"], "skip_eyes_closed")

	def test_side_glance_asymmetry_near_half_not_skipped(self):
		"""Left-monitor logs showed asymmetry ~0.46–0.50 — must not skip."""
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		t += 0.1
		# asymmetry = |0.30-0.155|/0.2275 ≈ 0.64? Need ~0.48
		# mean=0.25, |L-R|=0.12 → asym=0.48
		credited, info = state.detect(
			0.20,
			t,
			left_ear=0.31,
			right_ear=0.19,
		)
		self.assertNotEqual(info.get("phase"), "skip_degraded")

	def test_bilateral_degraded_skips_frame(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		t += 0.1
		# Strong asymmetry vs mean.
		credited, info = state.detect(
			0.20,
			t,
			left_ear=0.28,
			right_ear=0.08,
		)
		self.assertFalse(credited)
		self.assertEqual(info["phase"], "skip_degraded")

	def test_bilateral_agreement_required_for_credit(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		# Avg drops but only one eye participates → should not complete.
		credited_any = False
		steps = [
			(0.20, 0.28, 0.12),
			(0.14, 0.28, 0.00),
			(0.12, 0.28, 0.00),
			(0.24, 0.28, 0.20),
		]
		for avg, left, right in steps:
			t += 0.1
			credited, _ = state.detect(
				avg,
				t,
				left_ear=left,
				right_ear=right,
			)
			if credited:
				credited_any = True
		self.assertFalse(credited_any)

	def test_bilateral_agreeing_blink_credited(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		steps = [
			(0.20, 0.21, 0.19),
			(0.13, 0.14, 0.12),
			(0.11, 0.12, 0.10),
			(0.24, 0.24, 0.24),
		]
		credited_any = False
		for avg, left, right in steps:
			t += 0.1
			credited, info = state.detect(
				avg,
				t,
				left_ear=left,
				right_ear=right,
			)
			if credited:
				credited_any = True
				self.assertEqual(info["phase"], "complete")
		self.assertTrue(credited_any)

	def test_look_down_real_blink_credited(self):
		"""Screen-bottom gaze must still credit a fast blink (laptop UX)."""
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.26)
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		# Session resting pitch below current → look-down delta engages.
		state.resting_pitch = pose["pitch"] - 0.12
		self.assertTrue(
			evaluate_pose_gate(
				pose, "normal", resting_pitch=state.resting_pitch
			)["look_down"]
		)

		# Shallower absolute EAR (look-down foreshortening) but fast close.
		series = [0.20, 0.14, 0.12, 0.22]
		credited_any = False
		for ear in series:
			t += 0.1
			credited, info = state.detect(ear, t, pose=pose)
			if credited:
				credited_any = True
				self.assertEqual(info["phase"], "complete")
		self.assertTrue(credited_any)

	def test_look_down_rejects_slow_drift(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		state.resting_pitch = pose["pitch"] - 0.12
		self.assertTrue(
			evaluate_pose_gate(
				pose, "normal", resting_pitch=state.resting_pitch
			)["look_down"]
		)

		# Very slow close: ΔEAR 0.015 / 0.1s = 0.15 << min velocity.
		credited_any = False
		ear = 0.28
		for _ in range(12):
			ear -= 0.015
			t += 0.1
			credited, _ = state.detect(ear, t, pose=pose)
			if credited:
				credited_any = True
		for _ in range(8):
			ear = min(ear + 0.015, 0.28)
			t += 0.1
			credited, _ = state.detect(ear, t, pose=pose)
			if credited:
				credited_any = True
		self.assertFalse(credited_any)

	def test_look_down_rejects_marginal_velocity(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		state.resting_pitch = pose["pitch"] - 0.12
		gate = evaluate_pose_gate(
			pose, "normal", resting_pitch=state.resting_pitch
		)
		self.assertTrue(gate["look_down"])

		# ΔEAR 0.025 / 0.1s = 0.25 — below min 0.35 even with mild look-down.
		series = [0.255, 0.23, 0.22, 0.26]
		credited_any = False
		for ear in series:
			t += 0.1
			credited, _ = state.detect(ear, t, pose=pose)
			if credited:
				credited_any = True
		self.assertFalse(credited_any)

	def test_reset_clears_velocity_state(self):
		state = BlinkDetectionState()
		_seed_open_eye(state)
		state.detect(0.12, 5.0)
		state.reset()
		self.assertEqual(state.current_baseline_ear, 0.0)
		self.assertFalse(state.blink_in_progress)
		self.assertIsNone(state.prev_ear)
		self.assertEqual(state.peak_closing_velocity, 0.0)

	def test_ear_calibration_seeds_baseline(self):
		state = BlinkDetectionState()
		self.assertTrue(state.set_ear_calibration(0.31))
		self.assertAlmostEqual(state.ear_calibration, 0.31, places=5)
		self.assertAlmostEqual(state.current_baseline_ear, 0.31, places=5)
		self.assertEqual(len(state.baseline_ear_values), 15)

		# Immediate detect uses seeded baseline (no long warm-up).
		credited, info = state.detect(0.31, 1.0)
		self.assertFalse(credited)
		self.assertIsNotNone(info)
		self.assertAlmostEqual(info["baseline"], 0.31, delta=0.02)

	def test_ear_calibration_clears(self):
		state = BlinkDetectionState()
		state.set_ear_calibration(0.30)
		state.set_ear_calibration(None)
		self.assertIsNone(state.ear_calibration)
		# Live baseline kept after clear.
		self.assertGreater(state.current_baseline_ear, 0)

	def test_ear_calibration_survives_reset(self):
		state = BlinkDetectionState()
		state.set_ear_calibration(0.29)
		state.detect(0.12, 2.0)
		state.reset()
		self.assertAlmostEqual(state.ear_calibration, 0.29, places=5)
		self.assertAlmostEqual(state.current_baseline_ear, 0.29, places=5)

	def test_ear_calibration_clamps_and_rejects_invalid(self):
		state = BlinkDetectionState()
		self.assertTrue(state.set_ear_calibration(0.9))
		self.assertAlmostEqual(state.ear_calibration, 0.45, places=5)
		self.assertFalse(state.set_ear_calibration("bad"))
		self.assertFalse(state.set_ear_calibration(0))


if __name__ == "__main__":
	unittest.main()
