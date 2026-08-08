"""Crude head-pose estimates from dlib 68-point landmarks (no solvePnP)."""

# Matches BlinkDetectionState recovery when not looking down.
BLINK_RECOVERY_DEFAULT = 0.7

# Laptop webcam-on-top often reports absolute pitch ~0.15–0.25 at rest.
# Look-down uses *delta vs resting pitch*, not absolute pitch.
# Yaw hard-block is only for near-profile faces; side-monitor glances credit.
POSE_PROFILES = {
	"loose": {
		"yaw_extreme": 1.20,
		"pitch_look_down_delta": 0.05,
		"look_down_threshold_mult": 0.85,
		"look_down_velocity_mult": 1.0,
		"look_down_recovery": 0.62,
	},
	"normal": {
		"yaw_extreme": 1.10,
		"pitch_look_down_delta": 0.06,
		"look_down_threshold_mult": 0.88,
		"look_down_velocity_mult": 1.05,
		"look_down_recovery": 0.65,
	},
	"strict": {
		"yaw_extreme": 0.95,
		"pitch_look_down_delta": 0.07,
		"look_down_threshold_mult": 0.90,
		"look_down_velocity_mult": 1.1,
		"look_down_recovery": 0.68,
	},
}

DEFAULT_POSE_STRICTNESS = "normal"


def get_pose_profile(strictness=None):
	key = strictness if strictness in POSE_PROFILES else DEFAULT_POSE_STRICTNESS
	return POSE_PROFILES[key]


def _point(landmarks, index):
	pt = landmarks[index]
	return float(pt[0]), float(pt[1])


def _mean_xy(landmarks, start, end):
	count = end - start
	sx = 0.0
	sy = 0.0
	for index in range(start, end):
		x, y = _point(landmarks, index)
		sx += x
		sy += y
	return sx / count, sy / count


def estimate_head_pose(landmarks):
	"""
	Estimate normalized yaw/pitch from 68-point shape.

	yaw: 0 = frontal; magnitude grows toward profile (side monitor).
	pitch: 0 ≈ neutral geometry; positive = looking down (chin tuck).
	Absolute pitch is biased with top-mounted webcams — use resting delta.
	"""
	if landmarks is None or len(landmarks) < 68:
		return {"yaw": 0.0, "pitch": 0.0, "valid": False}

	left_eye = _mean_xy(landmarks, 36, 42)
	right_eye = _mean_xy(landmarks, 42, 48)
	nose = _point(landmarks, 30)
	chin = _point(landmarks, 8)

	eye_mid_x = (left_eye[0] + right_eye[0]) * 0.5
	eye_mid_y = (left_eye[1] + right_eye[1]) * 0.5
	interocular = abs(right_eye[0] - left_eye[0])
	if interocular < 1e-3:
		return {"yaw": 0.0, "pitch": 0.0, "valid": False}

	# Nose offset from eye midpoint, normalized by half interocular distance.
	yaw = (nose[0] - eye_mid_x) / (interocular * 0.5)

	face_height = chin[1] - eye_mid_y
	if face_height < 1e-3:
		return {"yaw": float(yaw), "pitch": 0.0, "valid": False}

	# Neutral nose sits ~45% of the way from eyes to chin; looking down
	# pulls the tip toward the eye line (smaller ratio → positive pitch).
	nose_ratio = (nose[1] - eye_mid_y) / face_height
	pitch = 0.45 - nose_ratio

	return {
		"yaw": float(yaw),
		"pitch": float(pitch),
		"valid": True,
	}


def evaluate_pose_gate(pose, strictness=None, resting_pitch=None):
	"""
	Return gate decision for blink credit.

	- extreme yaw (near profile) → block credit
	- look-down = pitch above session resting pitch by delta → relax drop %
	"""
	profile = get_pose_profile(strictness)
	if not pose or not pose.get("valid", False):
		return {
			"allow_credit": True,
			"look_down": False,
			"extreme_yaw": False,
			"threshold_mult": 1.0,
			"velocity_mult": 1.0,
			"recovery_threshold": BLINK_RECOVERY_DEFAULT,
			"yaw": 0.0,
			"pitch": 0.0,
			"pitch_delta": 0.0,
			"profile": profile,
		}

	yaw = float(pose.get("yaw", 0.0))
	pitch = float(pose.get("pitch", 0.0))
	extreme_yaw = abs(yaw) >= profile["yaw_extreme"]

	if resting_pitch is None:
		# No resting estimate yet — do not treat webcam bias as look-down.
		pitch_delta = 0.0
		look_down = False
	else:
		pitch_delta = pitch - float(resting_pitch)
		look_down = (not extreme_yaw) and pitch_delta >= profile[
			"pitch_look_down_delta"
		]

	threshold_mult = 1.0
	velocity_mult = 1.0
	recovery_threshold = BLINK_RECOVERY_DEFAULT
	if look_down:
		threshold_mult = profile["look_down_threshold_mult"]
		velocity_mult = profile["look_down_velocity_mult"]
		recovery_threshold = profile["look_down_recovery"]

	return {
		"allow_credit": not extreme_yaw,
		"look_down": look_down,
		"extreme_yaw": extreme_yaw,
		"threshold_mult": threshold_mult,
		"velocity_mult": velocity_mult,
		"recovery_threshold": recovery_threshold,
		"yaw": yaw,
		"pitch": pitch,
		"pitch_delta": pitch_delta,
		"profile": profile,
	}


def face_bbox_area(face):
	"""Area of a dlib rectangle (or duck-typed width/height object)."""
	try:
		return max(0, int(face.width()) * int(face.height()))
	except Exception:
		return 0


def interocular_distance_px(landmarks):
	"""Horizontal eye-center distance in pixels; 0 if landmarks invalid."""
	if landmarks is None or len(landmarks) < 48:
		return 0.0
	left_eye = _mean_xy(landmarks, 36, 42)
	right_eye = _mean_xy(landmarks, 42, 48)
	return abs(right_eye[0] - left_eye[0])


def select_largest_face(faces):
	"""Pick the largest face bbox; None if empty."""
	if not faces:
		return None
	best = None
	best_area = -1
	for face in faces:
		area = face_bbox_area(face)
		if area > best_area:
			best_area = area
			best = face
	return best
