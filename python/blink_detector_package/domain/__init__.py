"""Pure blink detection rules and state."""

from .blink_detection import (
	BLINK_DISPLAY_DURATION,
	BlinkDetectionState,
	get_adaptive_ear_drop_threshold,
)
from .pose import (
	DEFAULT_POSE_STRICTNESS,
	estimate_head_pose,
	evaluate_pose_gate,
	select_largest_face,
)

__all__ = [
	"BLINK_DISPLAY_DURATION",
	"BlinkDetectionState",
	"DEFAULT_POSE_STRICTNESS",
	"estimate_head_pose",
	"evaluate_pose_gate",
	"get_adaptive_ear_drop_threshold",
	"select_largest_face",
]
