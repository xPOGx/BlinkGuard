from collections import deque

from blink_detector_package.domain.pose import evaluate_pose_gate

BLINK_COOLDOWN = 0.55
BLINK_DISPLAY_DURATION = 0.2
BLINK_MIN_EAR_DROP = 0.19
BLINK_MIN_ABSOLUTE_EAR_DROP = 0.03
# Floor used inside min_blink_duration_s; actual min scales with target_fps.
BLINK_DURATION_MIN = 0.05
BLINK_DURATION_MAX = 0.6
BLINK_RECOVERY_THRESHOLD = 0.7
BASELINE_WINDOW_SIZE = 15

# Rolling mean on raw EAR before FSM (cuts 1-frame landmark jitter).
EAR_SMOOTH_WINDOW = 3
# EMA on closing velocity so a single-frame ΔEAR/Δt spike does not dominate.
VELOCITY_SMOOTH_ALPHA = 0.55
# Frames with smoothed EAR in the close band required before credit.
# Start frame counts as 1. Requiring 2+ rejected ~80% of real 20 FPS blinks
# (POG logs 2026-08-07: duration≈0.05, closed_frames=1 → reject_duration).
# Anti-jitter comes from EAR smooth + velocity EMA, not multi-frame hold.
MIN_CLOSED_FRAMES = 1
# Opening (reopen) velocity for V-shape; waived if closed_frames is deep enough.
# Gaming/center: soft reopen still real (POG reject_opening).
MIN_OPENING_VELOCITY = 0.06
DEFAULT_TARGET_FPS = 15
# Frames of closing |dEAR/dt| kept before blink start — smooth lag means the
# real close spike is often 1–2 frames before FSM enters the close band.
CLOSING_HISTORY_FRAMES = 5

# Peak closing |dEAR/dt| (EAR units / second). Tuned for ~10–15 FPS.
BLINK_MIN_CLOSING_VELOCITY = 0.35
# Short candidates: FPS-aware frontal via short_frontal_velocity(); look-down
# uses SHORT_BLINK_MIN_VELOCITY.
SHORT_BLINK_DURATION = 0.09
SHORT_BLINK_MIN_VELOCITY = 0.50

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
EYES_OPEN_RATIO = 0.74
EYES_CLOSED_HOLD_S = 0.18
# Must stay near-open this long to clear eyes_closed (noise while lids shut).
EYES_OPEN_HOLD_S = 0.12
# Safety: drop awaiting after this; if lids still not open → latch eyes_closed
# (clearing unlock while shut caused ~1s credit storms — POG 2026-08-08).
AWAITING_REOPEN_MAX_S = 0.35

# Frontal opening waive when effective (history/synthetic) close peak is strong
# but reopen velocity was missed — must match logged peak_velocity, not raw only.
FRONTAL_OPENING_PEAK_WAIVE = 0.95


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


def short_frontal_velocity(fps):
	"""FPS-aware short-blink closing velocity for frontal (non look-down)."""
	try:
		rate = float(fps)
	except (TypeError, ValueError):
		rate = DEFAULT_TARGET_FPS
	# Softened for center/gaming (POG dlib reject_velocity peak_p50≈0.07).
	if rate >= 18:
		return 0.40
	if rate >= 12:
		return 0.45
	return 0.50


def short_look_down_velocity(fps):
	"""
	FPS-aware short-blink closing velocity for look-down.

	Slightly stricter than frontal (soft eyelid drift FP) but no longer a
	flat 0.50 floor that mass-rejects real screen-bottom blinks at 15–20 FPS.
	"""
	try:
		rate = float(fps)
	except (TypeError, ValueError):
		rate = DEFAULT_TARGET_FPS
	if rate >= 18:
		return 0.42
	if rate >= 12:
		return 0.47
	return 0.50


# Strong drop can cover a short-velocity miss (smooth lag under-reports peak).
SHORT_BLINK_STRONG_DROP = 0.20
SHORT_BLINK_STRONG_ABS = 0.05

# Face / landmark quality (junk boxes produce symmetric-but-useless EAR).
# Absolute floors suit 320×240–640×480 processing resolutions.
MIN_FACE_AREA_PX = 1600  # ~40×40
MIN_INTEROCULAR_PX = 12.0


def min_blink_duration_s(fps):
	"""
	Minimum blink wall-clock duration.

	Do not use MIN_CLOSED_FRAMES/fps as a high floor (that made 0.10s at
	20 FPS and mass-rejected real blinks). At high FPS a one-frame
	start→reopen can be shorter than 50ms — keep a ~one-frame floor.
	"""
	try:
		rate = float(fps)
	except (TypeError, ValueError):
		rate = DEFAULT_TARGET_FPS
	if rate <= 0:
		rate = DEFAULT_TARGET_FPS
	one_frame = 1.0 / rate
	# ≈ one frame at target FPS, capped by the classic 50ms floor, floored
	# so sub-frame jitter cannot credit.
	return max(0.016, min(BLINK_DURATION_MIN, one_frame * 0.95))


def _ear_asymmetry(left_ear, right_ear):
	mean = (left_ear + right_ear) * 0.5
	if mean <= 1e-6:
		return 1.0
	return abs(left_ear - right_ear) / mean


def _bilateral_drops_agree(left_drop, right_drop, required_drop):
	"""True when both eyes show a real drop and magnitudes agree."""
	# Softened for near-threshold frontal (POG 2026-08-08: reject_bilateral
	# with peak≈1.45 but one eye slightly shallower).
	min_each = required_drop * 0.28
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
	def __init__(self, pose_strictness="normal", target_fps=DEFAULT_TARGET_FPS):
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
		# Measured closing peak only (raw deltas + pre-blink history).
		# Gate decisions may still use effective_peak (synthetic short-frontal).
		self.peak_closing_velocity_measured = 0.0
		self.peak_opening_velocity = 0.0
		self._smoothed_closing_velocity = 0.0
		self._closing_history = deque(maxlen=CLOSING_HISTORY_FRAMES)
		self.closed_frames = 0
		self.max_left_drop = 0.0
		self.max_right_drop = 0.0
		self._ear_window = deque(maxlen=EAR_SMOOTH_WINDOW)
		self.target_fps = float(target_fps) if target_fps else DEFAULT_TARGET_FPS
		# Personal open-eye EAR from Electron calibration; None when unset.
		self.ear_calibration = None
		# Session resting pitch (EMA); None until first open-eye sample.
		self.resting_pitch = None
		# After credit (or sustained low EAR): must see open eyes before next start.
		self.awaiting_reopen = False
		self.awaiting_reopen_since = None
		self.eyes_closed = False
		self._low_ear_since = None
		self._open_ear_since = None

	def set_target_fps(self, fps):
		"""Update expected camera FPS for duration / short-velocity gates."""
		try:
			value = float(fps)
		except (TypeError, ValueError):
			return False
		if value <= 0:
			return False
		self.target_fps = value
		return True

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

	def _smooth_ear(self, raw_ear):
		self._ear_window.append(float(raw_ear))
		return sum(self._ear_window) / len(self._ear_window)

	def _update_baseline(self, current_ear, look_down=False):
		"""Append/smooth open-eye baseline only when not blinking / not closed."""
		if self.blink_in_progress or self.eyes_closed or self.awaiting_reopen:
			return

		# Never pull baseline toward half-closed / shut EAR. Without this,
		# held-closed lids collapse baseline (~0.28→0.22) so shut eyes look
		# "open" and credit as a blink every cooldown (POG JSONL storm).
		if self.current_baseline_ear > 0:
			drop = (
				self.current_baseline_ear - float(current_ear)
			) / self.current_baseline_ear
			if drop > RESTING_PITCH_OPEN_DROP_MAX:
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
		"""
		Closing / opening from raw EAR deltas.

		Peak closing uses the unsmoothed spike — EAR rolling mean already
		stabilizes FSM bands; EMA-only peaks were too weak for real 20 FPS
		blinks (POG reject_velocity after duration fix).

		Also keep a short pre-blink closing history: start often fires after
		the trough, so the spike would otherwise be discarded (peak≈0 rejects).
		"""
		closing_raw = 0.0
		opening = 0.0
		if self.prev_ear is not None and self.prev_time is not None:
			dt = current_time - self.prev_time
			if dt > 1e-4:
				raw = (current_ear - self.prev_ear) / dt
				closing_raw = -raw if raw < 0 else 0.0
				opening = raw if raw > 0 else 0.0
				alpha = VELOCITY_SMOOTH_ALPHA
				self._smoothed_closing_velocity = (
					alpha * closing_raw
					+ (1.0 - alpha) * self._smoothed_closing_velocity
				)
				self._closing_history.append(closing_raw)
				if self.blink_in_progress and closing_raw > self.peak_closing_velocity:
					self.peak_closing_velocity = closing_raw
				if (
					self.blink_in_progress
					and closing_raw > self.peak_closing_velocity_measured
				):
					self.peak_closing_velocity_measured = closing_raw
				if (
					self.blink_in_progress
					and opening > self.peak_opening_velocity
				):
					self.peak_opening_velocity = opening

		self.prev_ear = current_ear
		self.prev_time = current_time
		return closing_raw, opening

	def _pre_blink_closing_peak(self):
		if not self._closing_history:
			return 0.0
		return max(self._closing_history)

	def _reset_blink_tracking(self):
		self.blink_in_progress = False
		self.peak_closing_velocity = 0.0
		self.peak_closing_velocity_measured = 0.0
		self.peak_opening_velocity = 0.0
		self.closed_frames = 0
		self.max_left_drop = 0.0
		self.max_right_drop = 0.0
		self.max_drop_percentage = 0.0

	def cancel_on_face_lost(self):
		"""
		Cancel an in-progress blink when the face disappears mid-candidate.

		Keeps baseline + EAR calibration. Clears velocity / EAR smooth so the
		next face frame does not inherit stale ΔEAR/Δt.
		Returns True when a candidate was cancelled.
		"""
		had_candidate = self.blink_in_progress
		if had_candidate:
			self._reset_blink_tracking()
		self.prev_ear = None
		self.prev_time = None
		self._smoothed_closing_velocity = 0.0
		self._closing_history.clear()
		self._ear_window.clear()
		return had_candidate

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
			# Still not clearly open → latch closed (do not unlock for new starts).
			if open_ratio < EYES_OPEN_RATIO:
				self.eyes_closed = True
				self._open_ear_since = None

		if open_ratio >= EYES_OPEN_RATIO:
			self._low_ear_since = None
			if self._open_ear_since is None:
				self._open_ear_since = current_time
			# Clear closed/await only after a short sustained open (anti noise).
			if (current_time - self._open_ear_since) >= EYES_OPEN_HOLD_S:
				self.eyes_closed = False
				self.awaiting_reopen = False
				self.awaiting_reopen_since = None
			return

		self._open_ear_since = None

		if open_ratio < EYES_CLOSED_RATIO:
			if self._low_ear_since is None:
				self._low_ear_since = current_time
			elif (current_time - self._low_ear_since) >= EYES_CLOSED_HOLD_S:
				# Latch even while a candidate is active so held-shut lids
				# become eyes_closed as soon as the candidate ends.
				self.eyes_closed = True
		else:
			# Between closed and open — clear sustained-closed timer only.
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
		`current_ear` is raw avg EAR; FSM uses a short rolling mean.
		"""
		ear_raw = float(current_ear)
		ear_smooth = self._smooth_ear(ear_raw)

		# Pre-drop estimate for resting-pitch updates (uses current baseline).
		pre_drop = 0.0
		if self.current_baseline_ear > 0:
			pre_drop = max(
				0.0,
				(self.current_baseline_ear - ear_smooth)
				/ self.current_baseline_ear,
			)
		self._update_resting_pitch(pose, pre_drop)

		gate = evaluate_pose_gate(
			pose,
			self.pose_strictness,
			resting_pitch=self.resting_pitch,
		)

		ear_fields = {
			"ear": ear_smooth,
			"ear_raw": ear_raw,
			"ear_smooth": ear_smooth,
			"closed_frames": self.closed_frames,
			"peak_opening_velocity": self.peak_opening_velocity,
		}

		# Extreme yaw (near profile): no credit; cancel in-progress blink.
		if gate["extreme_yaw"]:
			if self.blink_in_progress:
				self._reset_blink_tracking()
			self._update_velocity(ear_raw, current_time)
			return False, {
				"baseline": self.current_baseline_ear,
				"drop": 0.0,
				"phase": "skip_yaw",
				"threshold": 0.0,
				"yaw": gate["yaw"],
				"pitch": gate["pitch"],
				"pitch_delta": gate.get("pitch_delta", 0.0),
				**ear_fields,
			}

		# Strong L/R asymmetry → degraded landmarks; skip frame, no credit.
		if left_ear is not None and right_ear is not None:
			asymmetry = _ear_asymmetry(left_ear, right_ear)
			if asymmetry > EAR_ASYMMETRY_SKIP:
				if self.blink_in_progress:
					self._reset_blink_tracking()
				self._update_velocity(ear_raw, current_time)
				return False, {
					"baseline": self.current_baseline_ear,
					"drop": 0.0,
					"phase": "skip_degraded",
					"threshold": 0.0,
					"asymmetry": asymmetry,
					"yaw": gate["yaw"],
					"pitch": gate["pitch"],
					"pitch_delta": gate.get("pitch_delta", 0.0),
					**ear_fields,
				}

		self._update_baseline(ear_smooth, look_down=gate["look_down"])
		closing_velocity, opening_velocity = self._update_velocity(
			ear_raw,
			current_time,
		)

		if len(self.baseline_ear_values) < 5 and self.current_baseline_ear <= 0:
			return False, None

		if self.current_baseline_ear <= 0:
			return False, None

		self._update_eyes_closed_state(ear_smooth, current_time)

		ear_drop_percentage = (
			self.current_baseline_ear - ear_smooth
		) / self.current_baseline_ear
		ear_drop_absolute = self.current_baseline_ear - ear_smooth
		adaptive_threshold = get_adaptive_ear_drop_threshold(
			self.current_baseline_ear
		) * gate["threshold_mult"]
		min_velocity = BLINK_MIN_CLOSING_VELOCITY * gate["velocity_mult"]
		recovery_threshold = gate.get(
			"recovery_threshold",
			BLINK_RECOVERY_THRESHOLD,
		)
		# Hysteresis close band: below baseline * (1 - adaptive_threshold).
		close_band_ear = self.current_baseline_ear * (1.0 - adaptive_threshold)
		duration_min = min_blink_duration_s(self.target_fps)

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
			"eyes_closed": self.eyes_closed,
			"awaiting_reopen": self.awaiting_reopen,
			"target_fps": self.target_fps,
			**ear_fields,
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

		# Do not start a new candidate during cooldown — avoids FSM churn and
		# reject_cooldown storms from same-blink bounce (POG 2026-08-08: ~42%).
		cooldown_remaining = max(
			0.0,
			BLINK_COOLDOWN - (current_time - self.last_blink_time),
		)
		if (
			not self.blink_in_progress
			and cooldown_remaining > 0
			and ear_smooth < close_band_ear
			and ear_drop_absolute > BLINK_MIN_ABSOLUTE_EAR_DROP
			and ear_drop_percentage > 0
		):
			return False, {
				"baseline": self.current_baseline_ear,
				"drop": ear_drop_percentage,
				"phase": "skip_cooldown",
				"threshold": adaptive_threshold,
				"velocity": closing_velocity,
				"peak_velocity": self.peak_closing_velocity,
				"cooldown_remaining": cooldown_remaining,
				**info_pose,
			}

		# Start: smoothed EAR enters close band (hysteresis) with absolute floor.
		if (
			not self.blink_in_progress
			and ear_smooth < close_band_ear
			and ear_drop_absolute > BLINK_MIN_ABSOLUTE_EAR_DROP
			and ear_drop_percentage > 0
		):
			self.blink_in_progress = True
			self.blink_start_time = current_time
			self.max_drop_percentage = ear_drop_percentage
			# Close spike is often 1–2 frames before smooth enters the band.
			frame_dt = 1.0 / max(float(self.target_fps), 1.0)
			raw_drop = max(0.0, self.current_baseline_ear - ear_raw)
			implied_close = 0.0
			if raw_drop > ear_drop_absolute + 0.015:
				implied_close = raw_drop / max(frame_dt, 1e-3)
			pre_peak = self._pre_blink_closing_peak()
			# Look-down: keep pre-blink history (real close spikes), but do not
			# invent implied close from band-cross alone (soft drift FP).
			if gate["look_down"]:
				implied_close = 0.0
			measured = max(
				closing_velocity,
				self.peak_closing_velocity_measured,
				pre_peak,
			)
			self.peak_closing_velocity_measured = measured
			# Effective peak for gates may include frontal implied_close seed.
			self.peak_closing_velocity = max(measured, implied_close)
			self.peak_opening_velocity = 0.0
			self.closed_frames = 1
			self.max_left_drop = left_drop
			self.max_right_drop = right_drop
			info_pose["closed_frames"] = self.closed_frames
			info_pose["peak_opening_velocity"] = self.peak_opening_velocity
			return False, {
				"baseline": self.current_baseline_ear,
				"drop": ear_drop_percentage,
				"phase": "start",
				"threshold": adaptive_threshold,
				"velocity": closing_velocity,
				"peak_velocity": self.peak_closing_velocity,
				"peak_velocity_raw": self.peak_closing_velocity_measured,
				"peak_velocity_effective": self.peak_closing_velocity,
				**info_pose,
			}

		if self.blink_in_progress:
			# Count trough/hold frames only — do not inflate during reopen
			# while smoothed EAR is still below the close band.
			if ear_smooth < close_band_ear and opening_velocity <= 1e-6:
				self.closed_frames += 1
			if ear_drop_percentage > self.max_drop_percentage:
				self.max_drop_percentage = ear_drop_percentage
			if left_drop > self.max_left_drop:
				self.max_left_drop = left_drop
			if right_drop > self.max_right_drop:
				self.max_right_drop = right_drop

			info_pose["closed_frames"] = self.closed_frames
			info_pose["peak_opening_velocity"] = self.peak_opening_velocity

			blink_duration = current_time - self.blink_start_time
			clearly_shut = (
				ear_smooth < self.current_baseline_ear * EYES_CLOSED_RATIO
			)
			# Held-closed lids: do not run credit/reject gates on duration-max —
			# latch eyes_closed so noise cannot start the next candidate.
			if blink_duration > BLINK_DURATION_MAX + 1e-3 and clearly_shut:
				self._reset_blink_tracking()
				self.eyes_closed = True
				self.awaiting_reopen = False
				self.awaiting_reopen_since = None
				self._open_ear_since = None
				return False, {
					"baseline": self.current_baseline_ear,
					"drop": ear_drop_percentage,
					"phase": "skip_eyes_closed",
					"threshold": adaptive_threshold,
					"velocity": closing_velocity,
					"peak_velocity": self.peak_closing_velocity,
					"absolute_drop": ear_drop_absolute,
					**info_pose,
				}

			if (
				ear_smooth
				> self.current_baseline_ear * recovery_threshold
				or blink_duration > BLINK_DURATION_MAX + 1e-3
			):
				velocity_ok = self.peak_closing_velocity >= min_velocity
				absolute_drop = (
					self.current_baseline_ear * self.max_drop_percentage
				)
				# Short frontal: if history/seed missed the spike, infer from
				# depth/duration. Look-down keeps measured/history peak only
				# (synthetic would credit soft eyelid drifts at screen-bottom).
				frame_dt = 1.0 / max(float(self.target_fps), 1.0)
				measured_peak = self.peak_closing_velocity_measured
				effective_peak = self.peak_closing_velocity
				if (
					not gate["look_down"]
					and 0 < blink_duration < SHORT_BLINK_DURATION
				):
					synthetic = absolute_drop / max(blink_duration, frame_dt)
					effective_peak = max(effective_peak, synthetic)
				short_min = min_velocity
				if blink_duration < SHORT_BLINK_DURATION:
					short_min = (
						short_look_down_velocity(self.target_fps)
						if gate["look_down"]
						else short_frontal_velocity(self.target_fps)
					)
					velocity_ok = (
						effective_peak >= max(min_velocity, short_min)
					)
					# Strong blink shape: deep drop can cover a soft peak miss.
					if (
						not velocity_ok
						and not gate["look_down"]
						and self.max_drop_percentage >= SHORT_BLINK_STRONG_DROP
						and absolute_drop >= SHORT_BLINK_STRONG_ABS
						and effective_peak >= (min_velocity * 0.5)
					):
						velocity_ok = True
				# V-shape: opening spike, multi-frame hold, or (frontal) a
				# strong effective close peak when reopen velocity was missed
				# (synthetic/history can lift peak while raw stays <1.0 —
				# POG 2026-08-08: 142/187 reject_opening had logged peak≥1).
				opening_ok = (
					self.peak_opening_velocity >= MIN_OPENING_VELOCITY
					or self.closed_frames >= max(2, MIN_CLOSED_FRAMES + 1)
				)
				if (
					not opening_ok
					and not gate["look_down"]
					and effective_peak >= FRONTAL_OPENING_PEAK_WAIVE
				):
					opening_ok = True
				bilateral_ok = True
				if require_bilateral:
					bilateral_ok = _bilateral_drops_agree(
						self.max_left_drop,
						self.max_right_drop,
						adaptive_threshold,
					)

				closed_ok = self.closed_frames >= MIN_CLOSED_FRAMES
				# Epsilon: wall-clock dt at 20 FPS is often 0.05±1e-4 float;
				# sum of 0.1 steps can land at 0.6000000000000005.
				duration_ok = (
					blink_duration + 1e-3 >= duration_min
					and blink_duration <= BLINK_DURATION_MAX + 1e-3
					and closed_ok
				)
				threshold_ok = (
					self.max_drop_percentage > adaptive_threshold
					and absolute_drop > BLINK_MIN_ABSOLUTE_EAR_DROP
				)
				gates_ok = (
					duration_ok
					and threshold_ok
					and velocity_ok
					and opening_ok
					and bilateral_ok
					and gate["allow_credit"]
				)
				cooldown_remaining = max(
					0.0,
					BLINK_COOLDOWN - (current_time - self.last_blink_time),
				)
				peak_vel = effective_peak
				peak_open = self.peak_opening_velocity
				max_drop = self.max_drop_percentage
				max_drop_ear = self.current_baseline_ear * (1 - max_drop)
				closed_at_end = self.closed_frames

				def _outcome(phase, credited=False):
					return credited, {
						"baseline": self.current_baseline_ear,
						"drop": max_drop,
						"max_drop_ear": max_drop_ear,
						"duration": blink_duration,
						"phase": phase,
						"threshold": adaptive_threshold,
						"velocity": peak_vel,
						# peak_velocity stays effective for backward-compat logs.
						"peak_velocity": peak_vel,
						"peak_velocity_raw": measured_peak,
						"peak_velocity_effective": peak_vel,
						"peak_opening_velocity": peak_open,
						"closed_frames": closed_at_end,
						"cooldown_remaining": cooldown_remaining,
						"absolute_drop": self.current_baseline_ear - max_drop_ear,
						"require_bilateral": require_bilateral,
						**info_pose,
						"ear": ear_smooth,
						"ear_raw": ear_raw,
						"ear_smooth": ear_smooth,
						"closed_frames": closed_at_end,
						"peak_opening_velocity": peak_open,
					}

				if gates_ok:
					if cooldown_remaining <= 0:
						self.last_blink_time = current_time
						self._reset_blink_tracking()
						# Must fully reopen before another blink can start.
						self.awaiting_reopen = True
						self.awaiting_reopen_since = current_time
						self._low_ear_since = None
						self._open_ear_since = None
						return _outcome("complete", credited=True)

					self._reset_blink_tracking()
					return _outcome("reject_cooldown")

				# Prefer velocity over threshold when both fail so logs are not
				# dominated by reject_threshold for slow+shallow noise.
				if not duration_ok:
					reason = "reject_duration"
				elif not velocity_ok:
					reason = "reject_velocity"
				elif not opening_ok:
					reason = "reject_opening"
				elif not threshold_ok:
					reason = "reject_threshold"
				elif not bilateral_ok:
					reason = "reject_bilateral"
				else:
					reason = "reject_yaw"

				self._reset_blink_tracking()
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
		self.peak_closing_velocity_measured = 0.0
		self.peak_opening_velocity = 0.0
		self._smoothed_closing_velocity = 0.0
		self._closing_history.clear()
		self.closed_frames = 0
		self.max_left_drop = 0.0
		self.max_right_drop = 0.0
		self._ear_window.clear()
		self.resting_pitch = None
		self.awaiting_reopen = False
		self.awaiting_reopen_since = None
		self.eyes_closed = False
		self._low_ear_since = None
		self._open_ear_since = None
		# Keep ear_calibration across camera restarts; re-seed if set.
		if self.ear_calibration and self.ear_calibration > 0:
			self._seed_baseline(self.ear_calibration)
