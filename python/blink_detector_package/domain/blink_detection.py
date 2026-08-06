from collections import deque

from blink_detector_package.domain.pose import evaluate_pose_gate

BLINK_COOLDOWN = 0.2
BLINK_DISPLAY_DURATION = 0.2
BLINK_MIN_EAR_DROP = 0.19
BLINK_MIN_ABSOLUTE_EAR_DROP = 0.03
# Allow 1-frame completions at 15–20 FPS (~50–67ms) only with strong velocity
# (see SHORT_BLINK_MIN_VELOCITY). Soft 0.05 alone caused look-down FP storms.
BLINK_DURATION_MIN = 0.05
BLINK_DURATION_MAX = 0.6
BLINK_RECOVERY_THRESHOLD = 0.7
BASELINE_WINDOW_SIZE = 15

# Peak closing |dEAR/dt| (EAR units / second). Tuned for ~10–15 FPS
# (one-frame ΔEAR≈0.04–0.06). Slow look-down still fails; real blinks pass.
BLINK_MIN_CLOSING_VELOCITY = 0.35
# One-frame / sub-90ms candidates need a clear close spike (POG look-down FP
# had duration≈0.05 with peak_velocity often 0.36–0.75).
SHORT_BLINK_DURATION = 0.09
SHORT_BLINK_MIN_VELOCITY = 0.80

# |L-R| / mean — above this → degraded / asymmetric; skip frame, no credit.
# Side-monitor glances often land ~0.46–0.50; keep headroom below true junk.
EAR_ASYMMETRY_SKIP = 0.55

# Max relative |L-R| drop spread vs mean drop for bilateral agreement.
BILATERAL_MAX_SPREAD = 0.95

# EMA for session resting pitch (webcam-on-top bias compensation).
RESTING_PITCH_ALPHA = 0.08
# Only update resting pitch when eyes are near open baseline.
RESTING_PITCH_OPEN_DROP_MAX = 0.12

# Sustained low EAR (look-down / lids closed) — not a stream of micro-blinks.
# POG look-down "open" sits ~0.73–0.78 of baseline; requiring 0.85 left them
# stuck in skip_await_open. Reopen ≈ recovery band; closed = clearly shut.
EYES_CLOSED_RATIO = 0.52
EYES_OPEN_RATIO = 0.72
EYES_CLOSED_HOLD_S = 0.18
# Safety: never block new blinks forever if gaze stays mid-low.
AWAITING_REOPEN_MAX_S = 0.45


def get_adaptive_ear_drop_threshold(baseline_ear):
	"""Calculate the adaptive EAR drop percentage."""
	if baseline_ear <= 0.0:
		return BLINK_MIN_EAR_DROP

	min_ear = 0.15
	max_ear = 0.35
	max_threshold = 0.20
	min_threshold = 0.15
	clamped_ear = max(min_ear, min(baseline_ear, max_ear))
	slope = (max_threshold - min_threshold) / (max_ear - min_ear)
	return max_threshold - slope * (clamped_ear - min_ear)


def _ear_asymmetry(left_ear, right_ear):
	mean = (left_ear + right_ear) * 0.5
	if mean <= 1e-6:
		return 1.0
	return abs(left_ear - right_ear) / mean


def _bilateral_drops_agree(left_drop, right_drop, required_drop):
	"""True when both eyes show a real drop and magnitudes agree."""
	min_each = required_drop * 0.5
	if left_drop < min_each or right_drop < min_each:
		return False
	mean_drop = (left_drop + right_drop) * 0.5
	if mean_drop <= 1e-6:
		return False
	spread = abs(left_drop - right_drop) / mean_drop
	return spread <= BILATERAL_MAX_SPREAD


# Soft pull of live baseline toward personal open-eye calibration.
CALIBRATION_ANCHOR_WEIGHT = 0.1
# Plausible open-eye EAR clamp (matches shared/ear-calibration.ts).
EAR_CALIBRATION_MIN = 0.12
EAR_CALIBRATION_MAX = 0.45


class BlinkDetectionState:
	def __init__(self, pose_strictness="normal"):
		self.baseline_ear_values = deque(maxlen=BASELINE_WINDOW_SIZE)
		self.current_baseline_ear = 0.0
		self.blink_in_progress = False
		self.blink_start_time = 0.0
		self.last_blink_time = 0.0
		self.baseline_smoothing_factor = 0.3
		self.max_drop_percentage = 0.0
		self.pose_strictness = pose_strictness
		self.prev_ear = None
		self.prev_time = None
		self.peak_closing_velocity = 0.0
		self.max_left_drop = 0.0
		self.max_right_drop = 0.0
		# Personal open-eye EAR from Electron calibration; None when unset.
		self.ear_calibration = None
		# Session resting pitch (EMA); None until first open-eye sample.
		self.resting_pitch = None
		# After credit (or sustained low EAR): must see open eyes before next start.
		self.awaiting_reopen = False
		self.awaiting_reopen_since = None
		self.eyes_closed = False
		self._low_ear_since = None

	@staticmethod
	def calculate_baseline_ear(ear_values):
		if len(ear_values) < 5:
			return None

		weights = [
			0.5 + index * 0.5 / (len(ear_values) - 1)
			for index in range(len(ear_values))
		]
		weighted_sum = sum(
			ear * weight for ear, weight in zip(ear_values, weights)
		)
		return weighted_sum / sum(weights)

	def _seed_baseline(self, value):
		"""Fill the rolling window and set current baseline to value."""
		self.baseline_ear_values.clear()
		for _ in range(BASELINE_WINDOW_SIZE):
			self.baseline_ear_values.append(value)
		self.current_baseline_ear = value

	def set_ear_calibration(self, baseline):
		"""
		Apply or clear a personal open-eye EAR baseline.

		Pass None / non-positive to clear the anchor (live baseline kept).
		"""
		if baseline is None:
			self.ear_calibration = None
			return False

		try:
			value = float(baseline)
		except (TypeError, ValueError):
			return False

		if value <= 0:
			self.ear_calibration = None
			return False

		value = max(EAR_CALIBRATION_MIN, min(EAR_CALIBRATION_MAX, value))
		self.ear_calibration = value
		self._seed_baseline(value)
		return True

	def _update_baseline(self, current_ear, look_down=False):
		"""Append/smooth open-eye baseline only when not blinking / not closed."""
		if self.blink_in_progress or self.eyes_closed or self.awaiting_reopen:
			return

		self.baseline_ear_values.append(current_ear)
		if len(self.baseline_ear_values) < 5:
			return

		new_baseline = self.calculate_baseline_ear(self.baseline_ear_values)
		if not new_baseline:
			return

		if self.current_baseline_ear > 0:
			self.current_baseline_ear = (
				self.baseline_smoothing_factor * new_baseline
				+ (1 - self.baseline_smoothing_factor)
				* self.current_baseline_ear
			)
		else:
			self.current_baseline_ear = new_baseline

		# Soft-anchor toward personal calibration so session drift stays bounded.
		# Skip while looking down — frontal calibration would keep baseline too
		# high and make screen-bottom blinks look like shallow / instant events.
		if (
			not look_down
			and self.ear_calibration
			and self.ear_calibration > 0
		):
			weight = CALIBRATION_ANCHOR_WEIGHT
			self.current_baseline_ear = (
				(1 - weight) * self.current_baseline_ear
				+ weight * self.ear_calibration
			)

	def _update_velocity(self, current_ear, current_time):
		velocity = 0.0
		if self.prev_ear is not None and self.prev_time is not None:
			dt = current_time - self.prev_time
			if dt > 1e-4:
				raw = (current_ear - self.prev_ear) / dt
				# Closing = EAR decreasing → positive closing velocity.
				closing = -raw if raw < 0 else 0.0
				velocity = closing
				if self.blink_in_progress and closing > self.peak_closing_velocity:
					self.peak_closing_velocity = closing

		self.prev_ear = current_ear
		self.prev_time = current_time
		return velocity

	def _eye_drop(self, eye_ear):
		if self.current_baseline_ear <= 0 or eye_ear is None:
			return 0.0
		return max(
			0.0,
			(self.current_baseline_ear - eye_ear) / self.current_baseline_ear,
		)

	def _update_resting_pitch(self, pose, ear_drop_percentage):
		"""Track resting pitch while eyes are open (webcam bias compensation)."""
		if not pose or not pose.get("valid", False):
			return
		if self.blink_in_progress or self.eyes_closed or self.awaiting_reopen:
			return
		if ear_drop_percentage > RESTING_PITCH_OPEN_DROP_MAX:
			return
		pitch = float(pose.get("pitch", 0.0))
		if self.resting_pitch is None:
			self.resting_pitch = pitch
			return
		alpha = RESTING_PITCH_ALPHA
		self.resting_pitch = (
			(1 - alpha) * self.resting_pitch + alpha * pitch
		)

	def _update_eyes_closed_state(self, current_ear, current_time):
		"""
		Track sustained low EAR and post-credit reopen requirement.

		Look-down open-eye EAR is often ~0.73–0.78 of frontal baseline — reopen
		threshold must sit in that band or credits stall (skip_await_open storm).
		"""
		if self.current_baseline_ear <= 0:
			return

		open_ratio = current_ear / self.current_baseline_ear

		if (
			self.awaiting_reopen
			and self.awaiting_reopen_since is not None
			and (current_time - self.awaiting_reopen_since) >= AWAITING_REOPEN_MAX_S
		):
			self.awaiting_reopen = False
			self.awaiting_reopen_since = None

		if open_ratio >= EYES_OPEN_RATIO:
			self._low_ear_since = None
			self.eyes_closed = False
			self.awaiting_reopen = False
			self.awaiting_reopen_since = None
			return

		if open_ratio < EYES_CLOSED_RATIO:
			if self._low_ear_since is None:
				self._low_ear_since = current_time
			elif (
				not self.blink_in_progress
				and (current_time - self._low_ear_since) >= EYES_CLOSED_HOLD_S
			):
				self.eyes_closed = True
		else:
			# Between closed and open — clear sustained timer only.
			self._low_ear_since = None

	def detect(
		self,
		current_ear,
		current_time,
		left_ear=None,
		right_ear=None,
		pose=None,
	):
		"""
		Run blink state machine.

		Optional left/right EAR enable bilateral gates.
		Optional pose dict (yaw/pitch/valid) enables pose gates.
		"""
		# Pre-drop estimate for resting-pitch updates (uses current baseline).
		pre_drop = 0.0
		if self.current_baseline_ear > 0:
			pre_drop = max(
				0.0,
				(self.current_baseline_ear - current_ear)
				/ self.current_baseline_ear,
			)
		self._update_resting_pitch(pose, pre_drop)

		gate = evaluate_pose_gate(
			pose,
			self.pose_strictness,
			resting_pitch=self.resting_pitch,
		)

		# Extreme yaw (near profile): no credit; cancel in-progress blink.
		if gate["extreme_yaw"]:
			if self.blink_in_progress:
				self.blink_in_progress = False
				self.max_drop_percentage = 0.0
				self.peak_closing_velocity = 0.0
				self.max_left_drop = 0.0
				self.max_right_drop = 0.0
			self._update_velocity(current_ear, current_time)
			return False, {
				"baseline": self.current_baseline_ear,
				"drop": 0.0,
				"phase": "skip_yaw",
				"threshold": 0.0,
				"yaw": gate["yaw"],
				"pitch": gate["pitch"],
				"pitch_delta": gate.get("pitch_delta", 0.0),
			}

		# Strong L/R asymmetry → degraded landmarks; skip frame, no credit.
		if left_ear is not None and right_ear is not None:
			asymmetry = _ear_asymmetry(left_ear, right_ear)
			if asymmetry > EAR_ASYMMETRY_SKIP:
				if self.blink_in_progress:
					self.blink_in_progress = False
					self.max_drop_percentage = 0.0
					self.peak_closing_velocity = 0.0
					self.max_left_drop = 0.0
					self.max_right_drop = 0.0
				self._update_velocity(current_ear, current_time)
				return False, {
					"baseline": self.current_baseline_ear,
					"drop": 0.0,
					"phase": "skip_degraded",
					"threshold": 0.0,
					"asymmetry": asymmetry,
					"yaw": gate["yaw"],
					"pitch": gate["pitch"],
					"pitch_delta": gate.get("pitch_delta", 0.0),
				}

		self._update_baseline(current_ear, look_down=gate["look_down"])
		closing_velocity = self._update_velocity(current_ear, current_time)

		if len(self.baseline_ear_values) < 5 and self.current_baseline_ear <= 0:
			return False, None

		if self.current_baseline_ear <= 0:
			return False, None

		self._update_eyes_closed_state(current_ear, current_time)

		ear_drop_percentage = (
			self.current_baseline_ear - current_ear
		) / self.current_baseline_ear
		ear_drop_absolute = self.current_baseline_ear - current_ear
		adaptive_threshold = get_adaptive_ear_drop_threshold(
			self.current_baseline_ear
		) * gate["threshold_mult"]
		min_velocity = BLINK_MIN_CLOSING_VELOCITY * gate["velocity_mult"]
		recovery_threshold = gate.get(
			"recovery_threshold",
			BLINK_RECOVERY_THRESHOLD,
		)

		left_drop = self._eye_drop(left_ear)
		right_drop = self._eye_drop(right_ear)
		has_bilateral = left_ear is not None and right_ear is not None
		# Side glance / look-down → landmarks often asymmetric; don't require
		# bilateral agreement (avg EAR + velocity still gate the event).
		require_bilateral = (
			has_bilateral
			and not gate["look_down"]
			and abs(gate["yaw"]) < 0.35
		)

		info_pose = {
			"yaw": gate["yaw"],
			"pitch": gate["pitch"],
			"pitch_delta": gate.get("pitch_delta", 0.0),
			"look_down": gate["look_down"],
			"resting_pitch": self.resting_pitch,
			"pose_strictness": self.pose_strictness,
			"min_velocity": min_velocity,
			"left_ear": left_ear,
			"right_ear": right_ear,
			"ear": current_ear,
			"eyes_closed": self.eyes_closed,
			"awaiting_reopen": self.awaiting_reopen,
		}
		if left_ear is not None and right_ear is not None:
			info_pose["asymmetry"] = _ear_asymmetry(left_ear, right_ear)

		# Block new blink starts until lids clearly reopen (anti look-down storm).
		if (
			not self.blink_in_progress
			and (self.eyes_closed or self.awaiting_reopen)
		):
			return False, {
				"baseline": self.current_baseline_ear,
				"drop": ear_drop_percentage,
				"phase": (
					"skip_eyes_closed"
					if self.eyes_closed
					else "skip_await_open"
				),
				"threshold": adaptive_threshold,
				"velocity": closing_velocity,
				"peak_velocity": self.peak_closing_velocity,
				**info_pose,
			}

		if (
			not self.blink_in_progress
			and ear_drop_percentage > adaptive_threshold
			and ear_drop_absolute > BLINK_MIN_ABSOLUTE_EAR_DROP
			and ear_drop_percentage > 0
		):
			# Start on avg EAR; bilateral checked only at complete (when required).
			self.blink_in_progress = True
			self.blink_start_time = current_time
			self.max_drop_percentage = ear_drop_percentage
			self.peak_closing_velocity = max(
				closing_velocity,
				self.peak_closing_velocity,
			)
			self.max_left_drop = left_drop
			self.max_right_drop = right_drop
			return False, {
				"baseline": self.current_baseline_ear,
				"drop": ear_drop_percentage,
				"phase": "start",
				"threshold": adaptive_threshold,
				"velocity": closing_velocity,
				"peak_velocity": self.peak_closing_velocity,
				**info_pose,
			}

		if self.blink_in_progress:
			if ear_drop_percentage > self.max_drop_percentage:
				self.max_drop_percentage = ear_drop_percentage
			if left_drop > self.max_left_drop:
				self.max_left_drop = left_drop
			if right_drop > self.max_right_drop:
				self.max_right_drop = right_drop

			blink_duration = current_time - self.blink_start_time
			if (
				current_ear
				> self.current_baseline_ear * recovery_threshold
				or blink_duration > BLINK_DURATION_MAX
			):
				velocity_ok = self.peak_closing_velocity >= min_velocity
				if blink_duration < SHORT_BLINK_DURATION:
					velocity_ok = (
						self.peak_closing_velocity
						>= max(min_velocity, SHORT_BLINK_MIN_VELOCITY)
					)
				bilateral_ok = True
				if require_bilateral:
					bilateral_ok = _bilateral_drops_agree(
						self.max_left_drop,
						self.max_right_drop,
						adaptive_threshold,
					)

				duration_ok = (
					BLINK_DURATION_MIN <= blink_duration <= BLINK_DURATION_MAX
				)
				threshold_ok = (
					self.max_drop_percentage > adaptive_threshold
					and self.current_baseline_ear * self.max_drop_percentage
					> BLINK_MIN_ABSOLUTE_EAR_DROP
				)
				gates_ok = (
					duration_ok
					and threshold_ok
					and velocity_ok
					and bilateral_ok
					and gate["allow_credit"]
				)
				cooldown_remaining = max(
					0.0,
					BLINK_COOLDOWN - (current_time - self.last_blink_time),
				)
				peak_vel = self.peak_closing_velocity
				max_drop = self.max_drop_percentage
				max_drop_ear = self.current_baseline_ear * (1 - max_drop)

				def _outcome(phase, credited=False):
					return credited, {
						"baseline": self.current_baseline_ear,
						"drop": max_drop,
						"max_drop_ear": max_drop_ear,
						"duration": blink_duration,
						"phase": phase,
						"threshold": adaptive_threshold,
						"velocity": peak_vel,
						"peak_velocity": peak_vel,
						"cooldown_remaining": cooldown_remaining,
						"absolute_drop": self.current_baseline_ear - max_drop_ear,
						"require_bilateral": require_bilateral,
						**info_pose,
					}

				if gates_ok:
					if cooldown_remaining <= 0:
						self.last_blink_time = current_time
						self.blink_in_progress = False
						self.peak_closing_velocity = 0.0
						self.max_left_drop = 0.0
						self.max_right_drop = 0.0
						self.max_drop_percentage = 0.0
						# Must fully reopen before another blink can start.
						self.awaiting_reopen = True
						self.awaiting_reopen_since = current_time
						self._low_ear_since = None
						return _outcome("complete", credited=True)

					self.blink_in_progress = False
					self.peak_closing_velocity = 0.0
					self.max_left_drop = 0.0
					self.max_right_drop = 0.0
					self.max_drop_percentage = 0.0
					return _outcome("reject_cooldown")

				if not duration_ok:
					reason = "reject_duration"
				elif not threshold_ok:
					reason = "reject_threshold"
				elif not velocity_ok:
					reason = "reject_velocity"
				elif not bilateral_ok:
					reason = "reject_bilateral"
				else:
					reason = "reject_yaw"

				self.blink_in_progress = False
				self.peak_closing_velocity = 0.0
				self.max_left_drop = 0.0
				self.max_right_drop = 0.0
				self.max_drop_percentage = 0.0
				return _outcome(reason)

		return False, {
			"baseline": self.current_baseline_ear,
			"drop": ear_drop_percentage,
			"phase": "monitoring",
			"threshold": adaptive_threshold,
			"velocity": closing_velocity,
			"peak_velocity": self.peak_closing_velocity,
			**info_pose,
		}

	def reset(self):
		self.baseline_ear_values.clear()
		self.current_baseline_ear = 0.0
		self.blink_in_progress = False
		self.blink_start_time = 0.0
		self.last_blink_time = 0.0
		self.baseline_smoothing_factor = 0.3
		self.max_drop_percentage = 0.0
		self.prev_ear = None
		self.prev_time = None
		self.peak_closing_velocity = 0.0
		self.max_left_drop = 0.0
		self.max_right_drop = 0.0
		self.resting_pitch = None
		self.awaiting_reopen = False
		self.awaiting_reopen_since = None
		self.eyes_closed = False
		self._low_ear_since = None
		# Keep ear_calibration across camera restarts; re-seed if set.
		if self.ear_calibration and self.ear_calibration > 0:
			self._seed_baseline(self.ear_calibration)
