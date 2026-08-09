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
# Look-down talk bounces often land just above SHORT_BLINK_DURATION (~0.09–0.11).
LOOK_DOWN_SHORTISH_DURATION = 0.12
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
# Allow tiny upward noise; larger rises are look-down and must not chase
# resting (POG 2026-08-09: resting climb killed look_down → frontal FP storm).
RESTING_PITCH_UP_EPS = 0.01

# Live open-eye EAR tracks *current* lid height (frontal or look-down).
# Gates use this ref so look-down open (~0.73 of frontal) is "open", not
# half-closed — absolute frontal ratios caused skip_eyes_closed while chatting
# at screen bottom (POG 2026-08-09).
LIVE_OPEN_RISE_ALPHA = 0.35
LIVE_OPEN_FALL_ALPHA = 0.08
# Only lower live open when lids are stable (posture), never during a close.
LIVE_OPEN_FALL_MAX_CLOSING_VEL = 0.12
LIVE_OPEN_FALL_MAX_DELTA = 0.008
LIVE_OPEN_FALL_HOLD_S = 0.40
# live_open << session baseline → treat like look-down for synthetic/short vel.
LOOK_DOWN_EAR_CEILING = 0.88

# Sustained low EAR vs *live* open ref — not a stream of micro-blinks.
EYES_CLOSED_RATIO = 0.52
EYES_OPEN_RATIO = 0.70
# Soft clear band for look-down open (~0.73–0.85 of live ref).
EYES_OPEN_SOFT_RATIO = 0.85
# Look-down await clear (frontal still uses close-band ~0.84 anti-FP).
# Chat open often sits ~0.70–0.82 of live — requiring close-band made
# skip_await_open sticky while looking at screen bottom (POG 2026-08-09).
LOOK_DOWN_AWAIT_CLEAR_RATIO = 0.70
# Credit recovery for look-down (stricter than await-clear). 0.70 credited
# talk-jaw EAR dips; 0.80 was harsh in dark/slow reopen (POG reject_duration
# timeouts). 0.78 keeps talk FP down while allowing chat reopen.
LOOK_DOWN_CREDIT_RECOVERY_RATIO = 0.78
EYES_CLOSED_HOLD_S = 0.18
# Must stay near-open this long to clear eyes_closed (noise while lids shut).
EYES_OPEN_HOLD_S = 0.12
EYES_OPEN_SOFT_HOLD_S = 0.10
# Safety: drop awaiting after this; latch eyes_closed only if clearly shut
# (mid-band must not latch — skip_cooldown covers bounce; POG 2026-08-09).
AWAITING_REOPEN_MAX_S = 0.35
# Walk-away: after face missing this long, clear eyes_closed/await on return
# and re-seed live_open (POG 2026-08-09: <2 min away → sticky skip_eyes_closed).
FACE_ABSENT_CLEAR_GATES_S = 1.0
FACE_ABSENT_RESEED_LIVE_S = 1.5

# Opening waive when effective close peak is strong but reopen velocity missed.
# Applies frontal *and* look-down / ear_depressed (POG 2026-08-09 reject_opening).
FRONTAL_OPENING_PEAK_WAIVE = 0.95
# Look-down short + peak waive still needs depth or multi-frame (POG openV=0 FP).
LOOK_DOWN_SHORT_WAIVE_ABS = 0.10
# Look-down short without reopen: need deeper trough than talk jitter (~drop 0.25).
LOOK_DOWN_SHORT_OPEN_DROP = 0.35
LOOK_DOWN_SHORT_OPEN_CLOSED = 3
# Synthetic peak must beat measured by this to count as "invented" (needs V-shape).
SYNTHETIC_PEAK_EPS = 0.20
# Short shallow dips without a strong measured close → reject (POG FP).
SHORT_SHALLOW_ABS_FLOOR = 0.06
# Synthetic short frontal: invent-V needs real depth (POG rawV≈0 @ 50ms credits).
SYNTHETIC_SHORT_MIN_DROP = 0.28
SYNTHETIC_SHORT_MIN_ABS = 0.07
# Frontal short peak-waive without reopen still needs some depth.
FRONTAL_SHORT_WAIVE_ABS = 0.07
FRONTAL_SHORT_WAIVE_DROP = 0.22
# Cumulative |Δyaw|+|Δpitch| during candidate → reject_motion (head nod FP).
# 0.12 killed real blinks with peak≈2–5 (POG 2026-08-09 post-excellence).
MOTION_REJECT_DELTA = 0.22
# Strong measured blinks: waive motion (nod often coincides with real blink).
MOTION_WAIVE_PEAK = 1.2
MOTION_WAIVE_DROP = 0.35


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
	Short-blink closing velocity for look-down.

	Raised vs 0.45 after talk-jaw FP (POG 2026-08-09: short look_down
	credits with openV≈0, drop≈0.25, peak often still ≥0.9).
	"""
	try:
		rate = float(fps)
	except (TypeError, ValueError):
		rate = DEFAULT_TARGET_FPS
	if rate >= 18:
		return 0.75
	if rate >= 12:
		return 0.70
	return 0.65


# Strong drop can cover a short-velocity miss (smooth lag under-reports peak).
SHORT_BLINK_STRONG_DROP = 0.20
SHORT_BLINK_STRONG_ABS = 0.05

# Face / landmark quality (junk boxes produce symmetric-but-useless EAR).
# Absolute floors suit 320×240–640×480 processing resolutions.
MIN_FACE_AREA_PX = 1600  # ~40×40
MIN_INTEROCULAR_PX = 12.0
# HOG can miss several frames while talking / expression; hold last bbox.
FACE_MISS_HOLD_FRAMES = 8


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
		# Current open-lid EAR (adapts to look-down); gates use this, not only
		# the frontal session baseline.
		self.live_open_ear = 0.0
		self.ear_depressed = False
		self._live_open_stable_since = None
		self._prev_ear_for_live = None
		# Wall-clock when usable face EAR stopped (walk-away / too-far).
		self._face_absent_since = None
		# Pose at candidate start for head-motion reject.
		self._candidate_yaw = None
		self._candidate_pitch = None
		self._candidate_pose_delta = 0.0

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
		self.live_open_ear = float(value)

	def _ref_ear(self):
		"""Open-eye reference for drop / close / closed ratios."""
		if self.live_open_ear > 0:
			return self.live_open_ear
		return self.current_baseline_ear

	def _update_live_open_ear(self, ear_smooth, closing_velocity, current_time):
		"""
		Track current open-lid height so look-down open is not 'half-closed'.

		Rises quickly when lids open wider. Falls only after a stable low-velocity
		hold — never while lids are closing (slow blinks must not collapse ref
		before start; POG 2026-08-09 empty-log FN).
		"""
		ear = float(ear_smooth)
		if ear <= 0:
			return
		if self.live_open_ear <= 0:
			self.live_open_ear = ear
			self._prev_ear_for_live = ear
			self._live_open_stable_since = current_time
			return
		# Freeze only during an active candidate, or while lids are *clearly*
		# shut. Mid-band eyes_closed must still let live_open fall — otherwise
		# walk-away leaves a stale-high ref and skip_eyes_closed forever.
		if self.blink_in_progress:
			self._live_open_stable_since = None
			self._prev_ear_for_live = ear
			return
		if (
			self.eyes_closed
			and ear < self.live_open_ear * EYES_CLOSED_RATIO
		):
			self._live_open_stable_since = None
			self._prev_ear_for_live = ear
			return

		if ear >= self.live_open_ear * 0.92:
			alpha = LIVE_OPEN_RISE_ALPHA
			self.live_open_ear = (1 - alpha) * self.live_open_ear + alpha * ear
			self._live_open_stable_since = current_time
			self._prev_ear_for_live = ear
			self._refresh_ear_depressed()
			return

		delta = 0.0
		if self._prev_ear_for_live is not None:
			delta = abs(ear - self._prev_ear_for_live)
		self._prev_ear_for_live = ear

		stable = (
			closing_velocity <= LIVE_OPEN_FALL_MAX_CLOSING_VEL
			and delta <= LIVE_OPEN_FALL_MAX_DELTA
		)
		if not stable:
			self._live_open_stable_since = None
			self._refresh_ear_depressed()
			return

		if self._live_open_stable_since is None:
			self._live_open_stable_since = current_time
			self._refresh_ear_depressed()
			return

		if (
			current_time - self._live_open_stable_since
		) < LIVE_OPEN_FALL_HOLD_S:
			self._refresh_ear_depressed()
			return

		alpha = LIVE_OPEN_FALL_ALPHA
		self.live_open_ear = (1 - alpha) * self.live_open_ear + alpha * ear
		self._refresh_ear_depressed()

	def _refresh_ear_depressed(self):
		session = self.current_baseline_ear
		if session > 0 and self.live_open_ear > 0:
			self.ear_depressed = (
				self.live_open_ear / session
			) < LOOK_DOWN_EAR_CEILING
		else:
			self.ear_depressed = False

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
		self._candidate_yaw = None
		self._candidate_pitch = None
		self._candidate_pose_delta = 0.0

	def cancel_on_face_lost(self, current_time=None):
		"""
		Cancel an in-progress blink when the face disappears mid-candidate.

		Keeps baseline + EAR calibration. Clears velocity / EAR smooth so the
		next face frame does not inherit stale ΔEAR/Δt.
		Marks face absence so a longer walk-away can clear eyes_closed on return.
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
		if current_time is not None:
			self.mark_face_absent(current_time)
		return had_candidate

	def mark_face_absent(self, current_time):
		"""Start / keep face-absence timer (walk-away, too-far, black frame)."""
		if self._face_absent_since is None:
			self._face_absent_since = float(current_time)

	def _maybe_clear_after_face_return(self, current_time, ear_smooth):
		"""
		After a sustained face gap, drop presence gates and re-seed live_open.

		Short flicker (< FACE_ABSENT_CLEAR_GATES_S) keeps anti-FP latches.
		"""
		absent_since = self._face_absent_since
		if absent_since is None:
			return False
		gap = float(current_time) - float(absent_since)
		self._face_absent_since = None
		if gap < FACE_ABSENT_CLEAR_GATES_S:
			return False
		self.eyes_closed = False
		self.awaiting_reopen = False
		self.awaiting_reopen_since = None
		self._open_ear_since = None
		self._low_ear_since = None
		ear = float(ear_smooth) if ear_smooth is not None else 0.0
		if gap >= FACE_ABSENT_RESEED_LIVE_S and ear > 0:
			self.live_open_ear = ear
			self._prev_ear_for_live = ear
			self._live_open_stable_since = current_time
			self._refresh_ear_depressed()
		return True

	def _eye_drop(self, eye_ear):
		ref = self._ref_ear()
		if ref <= 0 or eye_ear is None:
			return 0.0
		return max(0.0, (ref - eye_ear) / ref)

	def _update_resting_pitch(self, pose, ear_drop_percentage):
		"""
		Track resting pitch while eyes are open (webcam bias compensation).

		Do not raise resting into a sustained look-down — chasing pitch_delta→0
		disables look_down gates and credits eyelid drift as frontal blinks.
		"""
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
		# Higher pitch = more look-down in our landmark heuristic.
		if pitch > self.resting_pitch + RESTING_PITCH_UP_EPS:
			return
		alpha = RESTING_PITCH_ALPHA
		self.resting_pitch = (
			(1 - alpha) * self.resting_pitch + alpha * pitch
		)

	def _update_eyes_closed_state(
		self, current_ear, current_time, look_down=False
	):
		"""
		Track sustained low EAR and post-credit reopen vs *live* open ref.

		Ratios are against live_open_ear so look-down open clears await/closed
		instead of sticking in skip_eyes_closed (POG 2026-08-09). Soft clear
		at EYES_OPEN_SOFT_RATIO unsticks chat look-down without full 0.70 hold.

		Frontal await clear must sit at/above the close band — clearing at 0.70
		while close≈0.84 re-arms start in the mid-band (~1 Hz FP). Look-down /
		ear_depressed use LOOK_DOWN_AWAIT_CLEAR_RATIO so chat open is not
		sticky skip_await_open.
		"""
		ref = self._ref_ear()
		if ref <= 0:
			return

		open_ratio = current_ear / ref
		close_ratio = 1.0 - get_adaptive_ear_drop_threshold(ref)
		if look_down:
			clear_open_ratio = max(
				EYES_OPEN_RATIO, LOOK_DOWN_AWAIT_CLEAR_RATIO
			)
		else:
			# Must leave the start zone before another candidate can arm.
			clear_open_ratio = max(EYES_OPEN_RATIO, close_ratio)

		if (
			self.awaiting_reopen
			and self.awaiting_reopen_since is not None
			and (current_time - self.awaiting_reopen_since) >= AWAITING_REOPEN_MAX_S
		):
			if open_ratio < EYES_CLOSED_RATIO:
				# Clearly shut → latch closed.
				self.awaiting_reopen = False
				self.awaiting_reopen_since = None
				self.eyes_closed = True
				self._open_ear_since = None
			elif open_ratio < close_ratio:
				if look_down:
					# Look-down resting open often sits under frontal close band;
					# do not refresh await forever (POG skip_await_open sticky).
					self.awaiting_reopen = False
					self.awaiting_reopen_since = None
				else:
					# Frontal mid-band — keep blocking; live_open may fall.
					self.awaiting_reopen_since = current_time
			else:
				self.awaiting_reopen = False
				self.awaiting_reopen_since = None

		if open_ratio >= clear_open_ratio:
			self._low_ear_since = None
			if self._open_ear_since is None:
				self._open_ear_since = current_time
			# Clear closed/await only after a short sustained open (anti noise).
			if (current_time - self._open_ear_since) >= EYES_OPEN_HOLD_S:
				self.eyes_closed = False
				self.awaiting_reopen = False
				self.awaiting_reopen_since = None
			return

		# Soft clear: look-down "open" often sits ~0.73–0.85 of live ref.
		if open_ratio >= EYES_OPEN_SOFT_RATIO and (
			self.eyes_closed or self.awaiting_reopen
		):
			self._low_ear_since = None
			if self._open_ear_since is None:
				self._open_ear_since = current_time
			elif (
				current_time - self._open_ear_since
			) >= EYES_OPEN_SOFT_HOLD_S:
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
		self._maybe_clear_after_face_return(current_time, ear_smooth)

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
		self._update_live_open_ear(ear_smooth, closing_velocity, current_time)

		if len(self.baseline_ear_values) < 5 and self.current_baseline_ear <= 0:
			return False, None

		ref = self._ref_ear()
		if ref <= 0:
			return False, None

		treat_as_look_down = bool(gate["look_down"] or self.ear_depressed)
		self._update_eyes_closed_state(
			ear_smooth,
			current_time,
			look_down=treat_as_look_down,
		)

		ear_drop_percentage = (ref - ear_smooth) / ref
		ear_drop_absolute = ref - ear_smooth
		adaptive_threshold = get_adaptive_ear_drop_threshold(
			ref
		) * gate["threshold_mult"]
		min_velocity = BLINK_MIN_CLOSING_VELOCITY * gate["velocity_mult"]
		recovery_threshold = gate.get(
			"recovery_threshold",
			BLINK_RECOVERY_THRESHOLD,
		)
		# Hysteresis close band vs live open height.
		close_band_ear = ref * (1.0 - adaptive_threshold)
		start_band_ear = close_band_ear
		duration_min = min_blink_duration_s(self.target_fps)

		left_drop = self._eye_drop(left_ear)
		right_drop = self._eye_drop(right_ear)
		has_bilateral = left_ear is not None and right_ear is not None
		# Side glance / look-down → landmarks often asymmetric; don't require
		# bilateral agreement (avg EAR + velocity still gate the event).
		require_bilateral = (
			has_bilateral
			and not treat_as_look_down
			and abs(gate["yaw"]) < 0.35
		)

		info_pose = {
			"yaw": gate["yaw"],
			"pitch": gate["pitch"],
			"pitch_delta": gate.get("pitch_delta", 0.0),
			"look_down": gate["look_down"],
			"ear_depressed": self.ear_depressed,
			"treat_as_look_down": treat_as_look_down,
			"live_open_ear": self.live_open_ear,
			"close_band_ear": close_band_ear,
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
				"baseline": ref,
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
		# Start: smoothed OR raw EAR enters close band (raw catches 1-frame lag).
		# Recovery/credit still use smooth.
		start_ear_hit = (
			ear_smooth < start_band_ear or ear_raw < start_band_ear
		)
		start_drop_abs = max(ear_drop_absolute, ref - ear_raw)
		start_drop_pct = start_drop_abs / ref if ref > 0 else 0.0
		if (
			not self.blink_in_progress
			and cooldown_remaining > 0
			and start_ear_hit
			and start_drop_abs > BLINK_MIN_ABSOLUTE_EAR_DROP
			and start_drop_pct > 0
		):
			return False, {
				"baseline": ref,
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
			and start_ear_hit
			and start_drop_abs > BLINK_MIN_ABSOLUTE_EAR_DROP
			and start_drop_pct > 0
		):
			self.blink_in_progress = True
			self.blink_start_time = current_time
			self.max_drop_percentage = max(ear_drop_percentage, start_drop_pct)
			# Close spike is often 1–2 frames before smooth enters the band.
			frame_dt = 1.0 / max(float(self.target_fps), 1.0)
			raw_drop = max(0.0, ref - ear_raw)
			implied_close = 0.0
			if raw_drop > ear_drop_absolute + 0.015:
				implied_close = raw_drop / max(frame_dt, 1e-3)
			pre_peak = self._pre_blink_closing_peak()
			# Look-down / ear-depressed: keep pre-blink history (real close
			# spikes), but do not invent implied close from band-cross alone.
			if treat_as_look_down:
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
			self._candidate_yaw = float(gate.get("yaw") or 0.0)
			self._candidate_pitch = float(gate.get("pitch") or 0.0)
			self._candidate_pose_delta = 0.0
			info_pose["closed_frames"] = self.closed_frames
			info_pose["peak_opening_velocity"] = self.peak_opening_velocity
			return False, {
				"baseline": ref,
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
			# Track head motion during candidate (open-source stability practice).
			if (
				self._candidate_yaw is not None
				and self._candidate_pitch is not None
			):
				dy = abs(float(gate.get("yaw") or 0.0) - self._candidate_yaw)
				dp = abs(
					float(gate.get("pitch") or 0.0) - self._candidate_pitch
				)
				self._candidate_pose_delta = max(
					self._candidate_pose_delta, dy + dp
				)
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
			info_pose["pose_delta"] = self._candidate_pose_delta

			blink_duration = current_time - self.blink_start_time
			clearly_shut = ear_smooth < ref * EYES_CLOSED_RATIO
			# Held-closed lids: do not run credit/reject gates on duration-max —
			# latch eyes_closed so noise cannot start the next candidate.
			if blink_duration > BLINK_DURATION_MAX + 1e-3 and clearly_shut:
				self._reset_blink_tracking()
				self.eyes_closed = True
				self.awaiting_reopen = False
				self.awaiting_reopen_since = None
				self._open_ear_since = None
				return False, {
					"baseline": ref,
					"drop": ear_drop_percentage,
					"phase": "skip_eyes_closed",
					"threshold": adaptive_threshold,
					"velocity": closing_velocity,
					"peak_velocity": self.peak_closing_velocity,
					"absolute_drop": ear_drop_absolute,
					**info_pose,
				}

			# Must leave the close band to complete. recovery_threshold (0.7) sits
			# *below* close≈0.84 — mid-band EAR credited every cooldown (POG
			# 2026-08-09 center-screen ~1 Hz storm).
			# Look-down: credit recovery is stricter than await-clear (talk FP).
			if treat_as_look_down:
				recovery_level = max(
					ref * recovery_threshold,
					ref * LOOK_DOWN_CREDIT_RECOVERY_RATIO,
				)
			else:
				recovery_level = max(ref * recovery_threshold, close_band_ear)
			recovered = ear_smooth > recovery_level
			if (
				recovered
				or blink_duration > BLINK_DURATION_MAX + 1e-3
			):
				velocity_ok = self.peak_closing_velocity >= min_velocity
				absolute_drop = ref * self.max_drop_percentage
				# Short frontal: if history/seed missed the spike, infer from
				# depth/duration. Look-down / ear-depressed: measured only
				# (synthetic would credit soft eyelid drifts at screen-bottom).
				frame_dt = 1.0 / max(float(self.target_fps), 1.0)
				measured_peak = self.peak_closing_velocity_measured
				effective_peak = self.peak_closing_velocity
				used_synthetic = False
				if (
					not treat_as_look_down
					and 0 < blink_duration < SHORT_BLINK_DURATION
				):
					synthetic = absolute_drop / max(blink_duration, frame_dt)
					if synthetic > effective_peak + 1e-9:
						used_synthetic = (
							synthetic > measured_peak + SYNTHETIC_PEAK_EPS
						)
					effective_peak = max(effective_peak, synthetic)
				short_min = min_velocity
				if blink_duration < SHORT_BLINK_DURATION:
					short_min = (
						short_look_down_velocity(self.target_fps)
						if treat_as_look_down
						else short_frontal_velocity(self.target_fps)
					)
					velocity_ok = (
						effective_peak >= max(min_velocity, short_min)
					)
					# Strong blink shape: deep drop can cover a soft peak miss.
					if (
						not velocity_ok
						and not treat_as_look_down
						and self.max_drop_percentage >= SHORT_BLINK_STRONG_DROP
						and absolute_drop >= SHORT_BLINK_STRONG_ABS
						and effective_peak >= (min_velocity * 0.5)
					):
						velocity_ok = True
				# V-shape: opening spike, multi-frame hold, or a strong *measured*
				# close peak when reopen velocity was missed. Do not waive on
				# synthetic effective_peak — abs/duration invents ≥0.95 for any
				# short mid-band dip (POG center FP storm).
				opening_ok = (
					self.peak_opening_velocity >= MIN_OPENING_VELOCITY
					or self.closed_frames >= max(2, MIN_CLOSED_FRAMES + 1)
				)
				# Look-down shortish talk-jaw: closed_frames=2 + openV=0 + drop≈0.25
				# was enough to credit (POG 2026-08-09). Require reopen or a
				# deeper multi-frame trough. Window extends past SHORT_BLINK
				# (0.09–0.11s talk bounces still FP).
				look_down_shortish = (
					treat_as_look_down
					and blink_duration < LOOK_DOWN_SHORTISH_DURATION
				)
				if look_down_shortish:
					opening_ok = (
						self.peak_opening_velocity >= MIN_OPENING_VELOCITY
						or (
							self.closed_frames >= LOOK_DOWN_SHORT_OPEN_CLOSED
							and self.max_drop_percentage
							>= LOOK_DOWN_SHORT_OPEN_DROP
						)
					)
				if (
					not opening_ok
					and measured_peak >= FRONTAL_OPENING_PEAK_WAIVE
				):
					if look_down_shortish:
						opening_ok = (
							absolute_drop >= LOOK_DOWN_SHORT_WAIVE_ABS
							and self.closed_frames
							>= max(2, MIN_CLOSED_FRAMES + 1)
						)
					elif blink_duration < SHORT_BLINK_DURATION:
						# Frontal short peak-waive still needs depth (open0 FP).
						opening_ok = (
							absolute_drop >= FRONTAL_SHORT_WAIVE_ABS
							and self.max_drop_percentage
							>= FRONTAL_SHORT_WAIVE_DROP
						)
					else:
						opening_ok = True
				# Synthetic-boosted short frontal must still show a real reopen
				# or multi-frame trough (POG excellence: invented-V FP).
				if used_synthetic and not (
					self.peak_opening_velocity >= MIN_OPENING_VELOCITY
					or self.closed_frames >= max(2, MIN_CLOSED_FRAMES + 1)
				):
					opening_ok = False
				# Invented peak + shallow drop (rawV≈0, drop≈0.16 @ 50ms).
				if used_synthetic and (
					self.max_drop_percentage < SYNTHETIC_SHORT_MIN_DROP
					or absolute_drop < SYNTHETIC_SHORT_MIN_ABS
					or measured_peak < short_frontal_velocity(self.target_fps) * 0.5
				):
					opening_ok = False
				bilateral_ok = True
				if require_bilateral:
					bilateral_ok = _bilateral_drops_agree(
						self.max_left_drop,
						self.max_right_drop,
						adaptive_threshold,
					)

				closed_ok = self.closed_frames >= MIN_CLOSED_FRAMES
				# Look-down: allow ~one-frame duration when measured peak is
				# clearly above talk jitter (raised short_look_down_velocity).
				effective_duration_min = duration_min
				if (
					treat_as_look_down
					and measured_peak
					>= short_look_down_velocity(self.target_fps)
				):
					effective_duration_min = min(
						duration_min, frame_dt * 0.95
					)
				# Min + closed only. BLINK_DURATION_MAX forces eval / latch
				# eyes_closed — do NOT put the upper bound in duration_ok
				# (POG 2026-08-09: all reject_duration were ~0.65s timeouts
				# with real peak/drop; upper bound auto-failed every timeout).
				duration_ok = (
					blink_duration + 1e-3 >= effective_duration_min
					and closed_ok
				)
				threshold_ok = (
					self.max_drop_percentage > adaptive_threshold
					and absolute_drop > BLINK_MIN_ABSOLUTE_EAR_DROP
				)
				# Short shallow without strong measured close → not a blink.
				if blink_duration < SHORT_BLINK_DURATION:
					shallow_vel_floor = max(min_velocity, short_min)
					if (
						absolute_drop < SHORT_SHALLOW_ABS_FLOOR
						and measured_peak < shallow_vel_floor
					):
						threshold_ok = False
				motion_ok = (
					self._candidate_pose_delta <= MOTION_REJECT_DELTA
					or (
						measured_peak >= MOTION_WAIVE_PEAK
						and self.max_drop_percentage >= MOTION_WAIVE_DROP
					)
				)
				gates_ok = (
					duration_ok
					and threshold_ok
					and velocity_ok
					and opening_ok
					and bilateral_ok
					and motion_ok
					and gate["allow_credit"]
					# Never credit on duration-max while still mid/closed —
					# must have reopened past recovery_level.
					and recovered
				)
				cooldown_remaining = max(
					0.0,
					BLINK_COOLDOWN - (current_time - self.last_blink_time),
				)
				peak_vel = effective_peak
				peak_open = self.peak_opening_velocity
				max_drop = self.max_drop_percentage
				max_drop_ear = ref * (1 - max_drop)
				closed_at_end = self.closed_frames
				pose_delta_at_end = self._candidate_pose_delta

				def _outcome(phase, credited=False):
					# info_pose first so explicit end-of-candidate fields win.
					return credited, {
						**info_pose,
						"baseline": ref,
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
						"absolute_drop": ref - max_drop_ear,
						"require_bilateral": require_bilateral,
						"pose_delta": pose_delta_at_end,
						"ear": ear_smooth,
						"ear_raw": ear_raw,
						"ear_smooth": ear_smooth,
					}

				def _arm_await_if_still_closed():
					# Reject while still in close band must not free start.
					if ear_smooth < close_band_ear:
						self.awaiting_reopen = True
						self.awaiting_reopen_since = current_time
						self._open_ear_since = None

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
					_arm_await_if_still_closed()
					return _outcome("reject_cooldown")

				# Prefer velocity over threshold when both fail so logs are not
				# dominated by reject_threshold for slow+shallow noise.
				if not duration_ok:
					reason = "reject_duration"
				elif not recovered:
					reason = "reject_duration"
				elif not velocity_ok:
					reason = "reject_velocity"
				elif not opening_ok:
					reason = "reject_opening"
				elif not threshold_ok:
					reason = "reject_threshold"
				elif not bilateral_ok:
					reason = "reject_bilateral"
				elif not motion_ok:
					reason = "reject_motion"
				else:
					reason = "reject_yaw"

				self._reset_blink_tracking()
				_arm_await_if_still_closed()
				return _outcome(reason)

		return False, {
			"baseline": ref,
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
		self.live_open_ear = 0.0
		self.ear_depressed = False
		self._live_open_stable_since = None
		self._prev_ear_for_live = None
		self._face_absent_since = None
		self._candidate_yaw = None
		self._candidate_pitch = None
		self._candidate_pose_delta = 0.0
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
