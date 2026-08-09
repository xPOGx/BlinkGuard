"""Unit tests for EAR blink FSM — no camera required."""

from __future__ import annotations

import unittest

from blink_detector_package.domain.blink_detection import (
	BLINK_MIN_CLOSING_VELOCITY,
	MIN_CLOSED_FRAMES,
	MIN_FACE_AREA_PX,
	MIN_INTEROCULAR_PX,
	MIN_OPENING_VELOCITY,
	BlinkDetectionState,
	get_adaptive_ear_drop_threshold,
	min_blink_duration_s,
	short_frontal_velocity,
	short_look_down_velocity,
)
from blink_detector_package.domain.pose import (
	estimate_head_pose,
	evaluate_pose_gate,
	interocular_distance_px,
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


def _seed_open_eye(state, ear=0.28, t0=1.0, frames=15, dt=0.1):
	"""Build a stable open-eye baseline (enough frames for EAR smooth window)."""
	for index in range(frames):
		credited, _info = state.detect(ear, t0 + index * dt)
		assert credited is False
	assert state.current_baseline_ear > 0
	return t0 + frames * dt


def _feed(state, t, steps, pose=None):
	"""
	Feed (dt, ear) or ear steps. Optional (dt, ear, left, right).
	Returns (credited_any, t, last_info, phases).
	last_info prefers the credited complete payload when present.
	"""
	credited_any = False
	last_info = None
	credited_info = None
	phases = []
	for step in steps:
		left = right = None
		if isinstance(step, tuple) and len(step) == 4:
			dt, ear, left, right = step
		elif isinstance(step, tuple) and len(step) == 2:
			dt, ear = step
		else:
			dt, ear = 0.1, step
		t += dt
		credited, info = state.detect(
			ear,
			t,
			left_ear=left,
			right_ear=right,
			pose=pose,
		)
		last_info = info
		if info:
			phases.append(info.get("phase"))
		if credited:
			credited_any = True
			credited_info = info
	return credited_any, t, credited_info or last_info, phases


# Deep close + hold (≥2 closed) + reopen past smooth recovery lag.
_CREDIT_STEPS = (
	(0.1, 0.16),
	(0.1, 0.10),
	(0.1, 0.08),
	(0.1, 0.07),
	(0.1, 0.22),
	(0.1, 0.28),
	(0.1, 0.28),
)


def _frontal_landmarks(yaw_offset=0.0, pitch_shift=0.0):
	"""
	Synthetic 68-pt cloud. yaw_offset moves nose in X;
	pitch_shift moves nose in Y (negative → look-down / smaller nose_ratio).
	"""
	points = [(0.0, 0.0)] * 68
	for i in range(17):
		points[i] = (100.0 + i * 10.0, 200.0)
	points[8] = (180.0, 260.0)

	for i in range(17, 27):
		points[i] = (120.0 + (i - 17) * 8.0, 120.0)

	for i in range(27, 31):
		points[i] = (180.0 + yaw_offset, 140.0 + (i - 27) * 12.0 + pitch_shift)
	points[30] = (180.0 + yaw_offset, 176.0 + pitch_shift)
	for i in range(31, 36):
		points[i] = (160.0 + (i - 31) * 10.0 + yaw_offset, 190.0 + pitch_shift)

	left = [(150, 150), (158, 145), (166, 145), (174, 150), (166, 155), (158, 155)]
	for i, (x, y) in enumerate(left):
		points[36 + i] = (float(x), float(y))
	right = [(186, 150), (194, 145), (202, 145), (210, 150), (202, 155), (194, 155)]
	for i, (x, y) in enumerate(right):
		points[42 + i] = (float(x), float(y))

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
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=22.0))
		self.assertGreater(abs(pose["yaw"]), 1.15)
		gate = evaluate_pose_gate(pose, "normal")
		self.assertTrue(gate["extreme_yaw"])
		self.assertFalse(gate["allow_credit"])

	def test_moderate_side_yaw_still_allows_credit(self):
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=10.0))
		gate = evaluate_pose_gate(pose, "normal")
		self.assertFalse(gate["extreme_yaw"])
		self.assertTrue(gate["allow_credit"])
		self.assertGreater(abs(pose["yaw"]), 0.3)
		self.assertLess(abs(pose["yaw"]), 1.10)

	def test_left_monitor_yaw_still_allows_credit(self):
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=18.0))
		self.assertGreater(abs(pose["yaw"]), 0.85)
		self.assertLess(abs(pose["yaw"]), 1.10)
		gate = evaluate_pose_gate(pose, "normal")
		self.assertFalse(gate["extreme_yaw"])
		self.assertTrue(gate["allow_credit"])

	def test_look_down_relaxes_drop_threshold(self):
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		resting = pose["pitch"] - 0.10
		gate = evaluate_pose_gate(pose, "normal", resting_pitch=resting)
		self.assertTrue(gate["look_down"])
		self.assertLess(gate["threshold_mult"], 1.0)
		self.assertGreaterEqual(gate["velocity_mult"], 1.0)
		self.assertLess(gate["recovery_threshold"], 0.7)
		self.assertTrue(gate["allow_credit"])

	def test_resting_pitch_avoids_false_look_down(self):
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-30.0))
		gate = evaluate_pose_gate(
			pose,
			"normal",
			resting_pitch=pose["pitch"],
		)
		self.assertFalse(gate["look_down"])
		self.assertAlmostEqual(gate["pitch_delta"], 0.0, places=5)


class BlinkDetectionTests(unittest.TestCase):
	def test_resting_pitch_does_not_chase_look_down(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		frontal = estimate_head_pose(_frontal_landmarks())
		down = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		state.resting_pitch = frontal["pitch"]
		before = state.resting_pitch
		self.assertGreater(down["pitch"], before + 0.05)
		for _ in range(40):
			t += 0.05
			state.detect(0.28, t, pose=down)
		self.assertLessEqual(state.resting_pitch, before + 1e-6)

	def test_resting_pitch_still_tracks_when_looking_up(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		high = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		low = estimate_head_pose(_frontal_landmarks())
		state.resting_pitch = high["pitch"]
		before = state.resting_pitch
		self.assertLess(low["pitch"], before - 0.05)
		for _ in range(40):
			t += 0.05
			state.detect(0.28, t, pose=low)
		self.assertLess(state.resting_pitch, before)

	def test_look_down_mild_ear_oscillation_no_credit_storm(self):
		"""Screen-bottom eyelid drift must not credit ~1 Hz without a blink."""
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		state.resting_pitch = pose["pitch"] - 0.12
		self.assertTrue(
			evaluate_pose_gate(
				pose, "normal", resting_pitch=state.resting_pitch
			)["look_down"]
		)
		# Adapt live open toward look-down height first.
		for level in (0.27, 0.26, 0.25, 0.24, 0.23):
			for _ in range(10):
				t += 0.05
				state.detect(level, t, pose=pose)
		credits = 0
		for index in range(80):
			t += 0.05
			ear = 0.235 if index % 2 == 0 else 0.225
			credited, _info = state.detect(ear, t, pose=pose)
			if credited:
				credits += 1
		self.assertLessEqual(credits, 1)

	def test_ear_depressed_mid_band_oscillation_no_credit_without_pitch(self):
		"""After live_open adapts to look-down height, mid-band jitter ≠ blink."""
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks())
		state.resting_pitch = pose["pitch"]
		# Stable hold below rise band so live_open falls; baseline stays high.
		for _ in range(40):
			t += 0.05
			state.detect(0.24, t, pose=pose)
		self.assertLess(state.live_open_ear, 0.25)
		self.assertTrue(state.ear_depressed)
		credits = 0
		for index in range(80):
			t += 0.05
			ear = 0.245 if index % 2 == 0 else 0.235
			credited, _info = state.detect(ear, t, pose=pose)
			if credited:
				credits += 1
		self.assertEqual(credits, 0)

	def test_ear_depressed_real_deep_blink_still_credited(self):
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks())
		state.resting_pitch = pose["pitch"]
		for _ in range(40):
			t += 0.05
			state.detect(0.24, t, pose=pose)
		self.assertTrue(state.ear_depressed)
		self.assertFalse(state.eyes_closed)
		steps = (
			(0.05, 0.12),
			(0.05, 0.08),
			(0.05, 0.06),
			(0.05, 0.18),
			(0.05, 0.24),
			(0.05, 0.24),
			(0.05, 0.24),
		)
		credited_any, _t, _info, phases = _feed(state, t, steps, pose=pose)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)
		self.assertFalse(state.eyes_closed)

	def test_live_open_ear_adapts_down_then_up(self):
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		frontal_open = state.live_open_ear
		for level in (0.27, 0.26, 0.25, 0.24, 0.23, 0.22, 0.21):
			for _ in range(12):
				t += 0.05
				state.detect(level, t)
		self.assertLess(state.live_open_ear, frontal_open * 0.9)
		for _ in range(20):
			t += 0.05
			state.detect(0.28, t)
		self.assertGreater(state.live_open_ear, 0.25)

	def test_live_open_does_not_fall_during_slow_close(self):
		"""Slow intentional close must start before live_open collapses."""
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		before = state.live_open_ear
		# Descending lids with measurable closing velocity / ΔEAR.
		phases = []
		for ear in (0.26, 0.24, 0.22, 0.20, 0.18, 0.16, 0.14):
			t += 0.05
			_c, info = state.detect(ear, t)
			if info:
				phases.append(info.get("phase"))
		self.assertGreater(state.live_open_ear, before * 0.92)
		self.assertIn("start", phases)

	def test_look_down_opening_waived_on_strong_peak(self):
		from blink_detector_package.domain.blink_detection import (
			FRONTAL_OPENING_PEAK_WAIVE,
		)

		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		state.resting_pitch = pose["pitch"] - 0.12
		self.assertTrue(
			evaluate_pose_gate(
				pose, "normal", resting_pitch=state.resting_pitch
			)["look_down"]
		)
		# Short deep trough: openVel≈0, closed_frames=1, strong peak.
		steps = (
			(0.05, 0.08),
			(0.05, 0.22),
			(0.05, 0.26),
			(0.05, 0.28),
		)
		credited_any, _t, info, phases = _feed(state, t, steps, pose=pose)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)
		self.assertGreaterEqual(
			info["peak_velocity"],
			FRONTAL_OPENING_PEAK_WAIVE,
		)

	def test_eyes_closed_soft_clear_at_look_down_open(self):
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		state.live_open_ear = 0.22
		state.eyes_closed = True
		# ~0.86 of live open — soft clear band, below hard 0.70 frontal-style.
		for _ in range(6):
			t += 0.05
			state.detect(0.19, t)
		self.assertFalse(state.eyes_closed)

	def test_walk_away_clears_eyes_closed_and_reseeds_live_open(self):
		"""Face gap ≥1.5s (leave desk) must not stick skip_eyes_closed on return."""
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		state.live_open_ear = 0.425
		state.eyes_closed = True
		state.awaiting_reopen = True
		state.awaiting_reopen_since = t
		state.cancel_on_face_lost(t)
		self.assertIsNotNone(state._face_absent_since)
		# <1s flicker: keep latches
		t += 0.5
		state.detect(0.29, t)
		self.assertTrue(state.eyes_closed)
		self.assertAlmostEqual(state.live_open_ear, 0.425, places=3)
		# Sustained absence then return at look-down open height.
		state.cancel_on_face_lost(t)
		t += 2.0
		state.detect(0.29, t)
		self.assertFalse(state.eyes_closed)
		self.assertFalse(state.awaiting_reopen)
		self.assertIsNone(state._face_absent_since)
		self.assertAlmostEqual(state.live_open_ear, 0.29, places=3)
		# Next deep blink should be able to start (not skip_eyes_closed).
		t += 0.05
		_c, info = state.detect(0.12, t)
		self.assertNotEqual(info.get("phase"), "skip_eyes_closed")

	def test_eyes_closed_mid_band_allows_live_open_fall(self):
		"""Sticky mid-band closed latch must not freeze an inflated live_open."""
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		state.live_open_ear = 0.42
		state.eyes_closed = True
		# Mid-band vs inflated live (not clearly shut <0.52×).
		for _ in range(40):
			t += 0.05
			state.detect(0.29, t)
		self.assertLess(state.live_open_ear, 0.36)

	def test_adaptive_threshold_bounds(self):
		low = get_adaptive_ear_drop_threshold(0.15)
		high = get_adaptive_ear_drop_threshold(0.35)
		self.assertGreaterEqual(low, high)
		self.assertAlmostEqual(low, 0.20, places=3)
		self.assertAlmostEqual(high, 0.15, places=3)

	def test_short_frontal_velocity_fps_bands(self):
		self.assertAlmostEqual(short_frontal_velocity(20), 0.40, places=3)
		self.assertAlmostEqual(short_frontal_velocity(18), 0.40, places=3)
		self.assertAlmostEqual(short_frontal_velocity(15), 0.45, places=3)
		self.assertAlmostEqual(short_frontal_velocity(12), 0.45, places=3)
		self.assertAlmostEqual(short_frontal_velocity(10), 0.50, places=3)

	def test_short_look_down_velocity_fps_bands(self):
		# 0.45 floor for look-down short blinks (above frontal@20, below old 0.50).
		self.assertAlmostEqual(short_look_down_velocity(20), 0.45, places=3)
		self.assertAlmostEqual(short_look_down_velocity(15), 0.45, places=3)
		self.assertAlmostEqual(short_look_down_velocity(10), 0.45, places=3)
		# Look-down short floor stays ≥ frontal at each band.
		self.assertGreaterEqual(
			short_look_down_velocity(20),
			short_frontal_velocity(20),
		)
		self.assertGreaterEqual(
			short_look_down_velocity(15),
			short_frontal_velocity(15),
		)

	def test_min_blink_duration_s_scales_with_high_fps(self):
		# ≤20 FPS keep ~50ms floor; Ultra/Max allow one-frame wall-clock.
		self.assertAlmostEqual(min_blink_duration_s(20), 0.0475, places=3)
		self.assertAlmostEqual(min_blink_duration_s(15), 0.05, places=3)
		self.assertAlmostEqual(min_blink_duration_s(10), 0.05, places=3)
		self.assertAlmostEqual(min_blink_duration_s(30), 0.0317, places=3)
		self.assertAlmostEqual(min_blink_duration_s(60), 0.016, places=3)

	def test_ear_smoothing_exposes_raw_and_smooth(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		t += 0.1
		credited, info = state.detect(0.10, t)
		self.assertFalse(credited)
		self.assertIsNotNone(info)
		self.assertIn("ear_raw", info)
		self.assertIn("ear_smooth", info)
		self.assertAlmostEqual(info["ear_raw"], 0.10, places=5)
		self.assertGreater(info["ear_smooth"], info["ear_raw"])
		self.assertAlmostEqual(info["ear"], info["ear_smooth"], places=5)

	def test_normal_blink_credited(self):
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		credited_any, _t, info, phases = _feed(state, t, _CREDIT_STEPS)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)
		self.assertGreaterEqual(info["peak_velocity"], BLINK_MIN_CLOSING_VELOCITY)
		self.assertGreaterEqual(info["closed_frames"], MIN_CLOSED_FRAMES)

	def test_shallow_flicker_rejected_by_velocity(self):
		"""Shallow 1-frame dip must not credit (velocity / drop gates)."""
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		credited_any, _t, _info, phases = _feed(
			state,
			t,
			((0.05, 0.24), (0.05, 0.27), (0.05, 0.28)),
		)
		self.assertFalse(credited_any)
		self.assertNotIn("complete", phases)

	def test_slow_look_down_rejected_by_velocity(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		credited_any = False
		ear = 0.28
		for _ in range(14):
			ear -= 0.01
			t += 0.1
			credited, _info = state.detect(ear, t)
			if credited:
				credited_any = True
		for _ in range(8):
			ear += 0.01
			t += 0.1
			credited, _info = state.detect(min(ear, 0.28), t)
			if credited:
				credited_any = True
		self.assertFalse(credited_any)

	def test_baseline_frozen_during_blink(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)

		for ear in (0.18, 0.12):
			t += 0.1
			state.detect(ear, t)
		self.assertTrue(state.blink_in_progress)
		frozen_baseline = state.current_baseline_ear
		len_at_start = len(state.baseline_ear_values)

		for ear in (0.11, 0.10, 0.09):
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
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)

		first, t, _info, _phases = _feed(state, t, _CREDIT_STEPS, pose=None)
		self.assertTrue(first)
		# Clear await-reopen / eyes_closed while still inside cooldown window.
		for ear in (0.24, 0.26, 0.28, 0.28):
			t += 0.05
			state.detect(ear, t)
		self.assertFalse(state.awaiting_reopen)
		self.assertFalse(state.eyes_closed)
		self.assertLess(t - state.last_blink_time, 0.55)
		# Bounce dip during cooldown must not start a candidate.
		t += 0.05
		credited, info = state.detect(0.10, t)
		self.assertFalse(credited)
		self.assertEqual(info["phase"], "skip_cooldown")
		self.assertGreater(info.get("cooldown_remaining", 0), 0)

	def test_extreme_yaw_no_credit(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=22.0))
		self.assertGreater(abs(pose["yaw"]), 1.15)
		self.assertTrue(evaluate_pose_gate(pose, "normal")["extreme_yaw"])
		credited_any, _t, _info, phases = _feed(
			state, t, _CREDIT_STEPS, pose=pose
		)
		self.assertFalse(credited_any)
		self.assertTrue(all(p == "skip_yaw" for p in phases))

	def test_moderate_side_yaw_blink_credited(self):
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks(yaw_offset=10.0))
		self.assertFalse(evaluate_pose_gate(pose, "normal")["extreme_yaw"])
		credited_any, _t, _info, phases = _feed(
			state, t, _CREDIT_STEPS, pose=pose
		)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)

	def test_one_closed_frame_at_20fps_can_credit(self):
		"""Real high-FPS blinks often have one trough sample then reopen."""
		self.assertAlmostEqual(min_blink_duration_s(20), 0.0475, places=3)
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks())
		# Extra open frames: EAR rolling mean must climb past recovery.
		steps = (
			(0.05, 0.08),
			(0.05, 0.24),
			(0.05, 0.28),
			(0.05, 0.28),
			(0.05, 0.28),
		)
		credited_any, _t, info, phases = _feed(state, t, steps, pose=pose)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)
		self.assertGreaterEqual(
			info["duration"], min_blink_duration_s(20) - 1e-6
		)
		self.assertGreaterEqual(info["closed_frames"], MIN_CLOSED_FRAMES)

	def test_short_blink_weak_velocity_rejected(self):
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		# Shallow trough: below strong-drop cover and waive peak.
		credited_any, _t, _info, phases = _feed(
			state,
			t,
			((0.067, 0.255), (0.067, 0.25), (0.067, 0.26), (0.067, 0.28)),
		)
		self.assertFalse(credited_any)
		self.assertNotIn("complete", phases)

	def test_short_frontal_moderate_velocity_credited(self):
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks())
		steps = (
			(0.05, 0.10),
			(0.05, 0.07),
			(0.05, 0.06),
			(0.05, 0.05),
			(0.05, 0.22),
			(0.05, 0.28),
			(0.05, 0.28),
		)
		credited_any, _t, info, phases = _feed(state, t, steps, pose=pose)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)
		self.assertFalse(info.get("look_down"))
		self.assertGreaterEqual(
			info["peak_velocity"],
			short_frontal_velocity(20),
		)

	def test_pre_blink_close_spike_credits_short_frontal(self):
		"""Close spike 1 frame before start must count (history), not peak≈0."""
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks())
		# Sharp close while still above close-band, then trough + reopen.
		steps = (
			(0.05, 0.12),
			(0.05, 0.08),
			(0.05, 0.22),
			(0.05, 0.28),
			(0.05, 0.28),
		)
		credited_any, _t, info, phases = _feed(state, t, steps, pose=pose)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)
		self.assertGreaterEqual(
			info["peak_velocity"],
			short_frontal_velocity(20),
		)

	def test_short_look_down_still_needs_strict_velocity(self):
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		state.resting_pitch = pose["pitch"] - 0.12
		gate = evaluate_pose_gate(
			pose, "normal", resting_pitch=state.resting_pitch
		)
		self.assertTrue(gate["look_down"])
		# Soft close under look-down short gate (0.45); reopen past close band.
		steps = (
			(0.1, 0.22),
			(0.1, 0.20),
			(0.1, 0.18),
			(0.1, 0.24),
			(0.1, 0.27),
			(0.1, 0.28),
		)
		credited_any, _t, info, phases = _feed(state, t, steps, pose=pose)
		self.assertFalse(credited_any)
		self.assertIn("reject_velocity", phases)
		self.assertLess(
			info.get("peak_velocity_raw", info.get("peak_velocity", 99)),
			short_look_down_velocity(15),
		)

	def test_opening_reject_when_shallow_reopen(self):
		"""V-shape: weak opening with only one closed frame → reject_opening."""
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		state.blink_in_progress = True
		state.blink_start_time = t - 0.25
		state.closed_frames = 1
		# Below frontal measured-peak waive (0.95); duration long so no
		# synthetic inflation of peak.
		state.peak_closing_velocity = 0.5
		state.peak_closing_velocity_measured = 0.5
		state.peak_opening_velocity = 0.02
		state.max_drop_percentage = 0.55
		state.prev_ear = 0.24
		state.prev_time = t
		state._ear_window.clear()
		for _ in range(3):
			state._ear_window.append(0.24)
		# Exit close band with almost no opening velocity delta.
		t += 0.2
		credited, info = state.detect(0.245, t)
		self.assertFalse(credited)
		self.assertEqual(info["phase"], "reject_opening")
		self.assertLess(
			info.get("peak_opening_velocity", 1.0),
			MIN_OPENING_VELOCITY,
		)
		self.assertLess(info.get("closed_frames", 99), 2)

	def test_opening_waived_when_measured_peak_strong(self):
		"""Measured peak ≥ waive credits with openVel≈0 (not synthetic)."""
		from blink_detector_package.domain.blink_detection import (
			FRONTAL_OPENING_PEAK_WAIVE,
		)

		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.28)
		pose = estimate_head_pose(_frontal_landmarks())
		# Fast deep trough → measured close peak ≥ waive; reopen past close.
		steps = (
			(0.05, 0.08),
			(0.05, 0.22),
			(0.05, 0.28),
			(0.05, 0.28),
		)
		credited_any, _t, info, phases = _feed(state, t, steps, pose=pose)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)
		self.assertGreaterEqual(
			info.get("peak_velocity_raw", info["peak_velocity"]),
			FRONTAL_OPENING_PEAK_WAIVE,
		)

	def test_center_mid_band_no_credit_storm(self):
		"""EAR stuck ~0.73–0.80 of live must not credit ~1 Hz (POG center FP)."""
		state = BlinkDetectionState(target_fps=20)
		t = _seed_open_eye(state, ear=0.30)
		pose = estimate_head_pose(_frontal_landmarks())
		state.resting_pitch = pose["pitch"]
		credits = 0
		for index in range(120):
			t += 0.05
			# Oscillate inside close band but above old 0.70 recovery.
			ear = 0.23 if index % 2 == 0 else 0.22
			credited, _info = state.detect(ear, t, pose=pose)
			if credited:
				credits += 1
		self.assertEqual(credits, 0)

	def test_await_reopen_blocks_rapid_second_blink(self):
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		credited_first, t, _info, _phases = _feed(state, t, _CREDIT_STEPS)
		self.assertTrue(credited_first)
		# Completing blink leaves smooth EAR open; re-arm await and pull the
		# smooth window into the mid band so reopen gate is observable.
		state.awaiting_reopen = True
		state.awaiting_reopen_since = t
		state.eyes_closed = False
		state._ear_window.clear()
		for _ in range(3):
			state._ear_window.append(0.19)
		t += 0.1
		credited, info = state.detect(0.19, t)
		self.assertFalse(credited)
		self.assertIn(info["phase"], ("skip_await_open", "skip_eyes_closed"))
		# Clear await only after leaving the close band and holding open.
		for ear in (0.26, 0.28, 0.28, 0.28):
			t += 0.1
			state.detect(ear, t)
		self.assertFalse(state.awaiting_reopen)
		self.assertFalse(state.eyes_closed)

	def test_await_reopen_expires_latches_eyes_closed_if_still_shut(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		state.awaiting_reopen = True
		state.awaiting_reopen_since = t
		t += 0.5
		# Clearly shut (< EYES_CLOSED_RATIO) after timeout → latch closed.
		state._update_eyes_closed_state(0.12, t)
		self.assertFalse(state.awaiting_reopen)
		self.assertTrue(state.eyes_closed)

	def test_await_reopen_expires_mid_band_keeps_blocking(self):
		"""Mid-band timeout must not free start (POG center FP re-arm)."""
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		state.awaiting_reopen = True
		state.awaiting_reopen_since = t
		t += 0.5
		# Mid-band still inside close zone → keep awaiting (timer refresh).
		state._update_eyes_closed_state(0.18, t)
		self.assertTrue(state.awaiting_reopen)
		self.assertFalse(state.eyes_closed)

	def test_sustained_low_ear_marks_eyes_closed(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		# Drive smooth EAR into sustained-closed band (smoothing lags).
		for ear in (0.12, 0.11, 0.10):
			t += 0.1
			state.detect(ear, t)
		# Abort any in-progress blink then mark sustained closed.
		state.blink_in_progress = False
		state._reset_blink_tracking()
		state._low_ear_since = t - 0.2
		state._update_eyes_closed_state(0.10, t)
		self.assertTrue(state.eyes_closed)
		credited, info = state.detect(0.10, t + 0.05)
		self.assertFalse(credited)
		self.assertEqual(info["phase"], "skip_eyes_closed")

	def test_baseline_not_pulled_down_by_half_closed_ear(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		baseline = state.current_baseline_ear
		# Mid-band EAR (drop > 12%) must not collapse open-eye baseline.
		for _ in range(20):
			t += 0.1
			state.detect(0.20, t)
		self.assertGreater(state.current_baseline_ear, baseline * 0.92)

	def test_held_closed_eyes_no_credit_storm(self):
		"""Shut lids for several seconds must not credit a blink every cooldown."""
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		baseline = state.current_baseline_ear
		credits = 0
		# Noisy closed-eye EAR around 0.12–0.16 (matches POG storm logs shape
		# after baseline collapse — here baseline must stay high).
		for index in range(80):
			t += 0.05
			ear = 0.12 + (0.04 if index % 3 == 0 else 0.0)
			credited, _info = state.detect(ear, t)
			if credited:
				credits += 1
		self.assertLessEqual(credits, 1)
		self.assertGreater(state.current_baseline_ear, baseline * 0.90)
		self.assertTrue(state.eyes_closed)

	def test_side_glance_asymmetry_near_half_not_skipped(self):
		state = BlinkDetectionState()
		t = _seed_open_eye(state, ear=0.28)
		t += 0.1
		_credited, info = state.detect(
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
		credited, info = state.detect(
			0.20,
			t,
			left_ear=0.28,
			right_ear=0.08,
		)
		self.assertFalse(credited)
		self.assertEqual(info["phase"], "skip_degraded")

	def test_bilateral_agreement_required_for_credit(self):
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		steps = (
			(0.1, 0.16, 0.28, 0.10),
			(0.1, 0.10, 0.28, 0.00),
			(0.1, 0.08, 0.28, 0.00),
			(0.1, 0.07, 0.28, 0.00),
			(0.1, 0.22, 0.28, 0.16),
			(0.1, 0.28, 0.28, 0.28),
			(0.1, 0.28, 0.28, 0.28),
		)
		credited_any, _t, _info, _phases = _feed(state, t, steps)
		self.assertFalse(credited_any)

	def test_bilateral_agreeing_blink_credited(self):
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		steps = (
			(0.1, 0.16, 0.17, 0.15),
			(0.1, 0.10, 0.11, 0.09),
			(0.1, 0.08, 0.09, 0.07),
			(0.1, 0.07, 0.08, 0.06),
			(0.1, 0.22, 0.22, 0.22),
			(0.1, 0.28, 0.28, 0.28),
			(0.1, 0.28, 0.28, 0.28),
		)
		credited_any, _t, _info, phases = _feed(state, t, steps)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)

	def test_look_down_real_blink_credited(self):
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.26)
		pose = estimate_head_pose(_frontal_landmarks(pitch_shift=-35.0))
		state.resting_pitch = pose["pitch"] - 0.12
		self.assertTrue(
			evaluate_pose_gate(
				pose, "normal", resting_pitch=state.resting_pitch
			)["look_down"]
		)
		steps = (
			(0.1, 0.14),
			(0.1, 0.08),
			(0.1, 0.06),
			(0.1, 0.05),
			(0.1, 0.18),
			(0.1, 0.24),
			(0.1, 0.26),
		)
		credited_any, _t, _info, phases = _feed(state, t, steps, pose=pose)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)

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

		steps = ((0.1, 0.255), (0.1, 0.23), (0.1, 0.22), (0.1, 0.21), (0.1, 0.26), (0.1, 0.28))
		credited_any, _t, _info, _phases = _feed(state, t, steps, pose=pose)
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
		self.assertEqual(state.peak_closing_velocity_measured, 0.0)
		self.assertEqual(state.closed_frames, 0)

	def test_cancel_on_face_lost_clears_candidate_keeps_calibration(self):
		state = BlinkDetectionState()
		state.set_ear_calibration(0.30)
		t = _seed_open_eye(state, ear=0.30)
		t += 0.1
		state.detect(0.12, t)
		self.assertTrue(state.blink_in_progress)
		baseline = state.current_baseline_ear
		self.assertTrue(state.cancel_on_face_lost(t))
		self.assertFalse(state.blink_in_progress)
		self.assertIsNone(state.prev_ear)
		self.assertEqual(len(state._ear_window), 0)
		self.assertAlmostEqual(state.ear_calibration, 0.30, places=5)
		self.assertAlmostEqual(state.current_baseline_ear, baseline, places=5)
		self.assertIsNotNone(state._face_absent_since)
		# Second call with no candidate is a no-op cancel.
		self.assertFalse(state.cancel_on_face_lost(t + 0.1))

	def test_completion_logs_measured_and_effective_peak(self):
		state = BlinkDetectionState(target_fps=15)
		t = _seed_open_eye(state, ear=0.28)
		credited_any, _t, info, phases = _feed(state, t, _CREDIT_STEPS)
		self.assertTrue(credited_any)
		self.assertIn("complete", phases)
		self.assertIn("peak_velocity_raw", info)
		self.assertIn("peak_velocity_effective", info)
		self.assertAlmostEqual(
			info["peak_velocity"],
			info["peak_velocity_effective"],
			places=5,
		)
		self.assertGreaterEqual(
			info["peak_velocity_effective"],
			info["peak_velocity_raw"],
		)

	def test_interocular_distance_and_face_quality_floors(self):
		landmarks = _frontal_landmarks()
		iod = interocular_distance_px(landmarks)
		self.assertGreater(iod, MIN_INTEROCULAR_PX)
		self.assertGreater(MIN_FACE_AREA_PX, 0)
		self.assertEqual(interocular_distance_px(None), 0.0)

	def test_set_target_fps(self):
		state = BlinkDetectionState(target_fps=10)
		self.assertTrue(state.set_target_fps(20))
		self.assertEqual(state.target_fps, 20.0)
		self.assertFalse(state.set_target_fps(0))
		self.assertFalse(state.set_target_fps("bad"))

	def test_ear_calibration_seeds_baseline(self):
		state = BlinkDetectionState()
		self.assertTrue(state.set_ear_calibration(0.31))
		self.assertAlmostEqual(state.ear_calibration, 0.31, places=5)
		self.assertAlmostEqual(state.current_baseline_ear, 0.31, places=5)
		self.assertEqual(len(state.baseline_ear_values), 15)

		credited, info = state.detect(0.31, 1.0)
		self.assertFalse(credited)
		self.assertIsNotNone(info)
		self.assertAlmostEqual(info["baseline"], 0.31, delta=0.02)

	def test_ear_calibration_clears(self):
		state = BlinkDetectionState()
		state.set_ear_calibration(0.30)
		state.set_ear_calibration(None)
		self.assertIsNone(state.ear_calibration)
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
