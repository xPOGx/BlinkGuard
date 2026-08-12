"""Pure blink detection rules and state."""

from .blink_detection import (
	BLINK_DISPLAY_DURATION,
	MIN_FACE_AREA_PX,
	MIN_INTEROCULAR_PX,
	BlinkDetectionState,
	get_adaptive_ear_drop_threshold,
)
from .pose import (
	DEFAULT_POSE_STRICTNESS,
	estimate_head_pose_heuristic,
	evaluate_pose_gate,
	face_bbox_area,
	face_bbox_plausible,
	interocular_distance_px,
	select_largest_face,
)

__all__ = [
	"BLINK_DISPLAY_DURATION",
	"BlinkDetectionState",
	"DEFAULT_POSE_STRICTNESS",
	"MIN_FACE_AREA_PX",
	"MIN_INTEROCULAR_PX",
	"estimate_head_pose_heuristic",
	"evaluate_pose_gate",
	"face_bbox_area",
	"face_bbox_plausible",
	"get_adaptive_ear_drop_threshold",
	"interocular_distance_px",
	"select_largest_face",
]
