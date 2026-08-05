"""Pure blink detection rules and state."""

from .blink_detection import (
    BLINK_DISPLAY_DURATION,
    BlinkDetectionState,
    get_adaptive_ear_drop_threshold,
)

__all__ = [
    "BLINK_DISPLAY_DURATION",
    "BlinkDetectionState",
    "get_adaptive_ear_drop_threshold",
]
