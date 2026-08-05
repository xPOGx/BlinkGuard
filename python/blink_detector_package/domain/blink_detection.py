from collections import deque

BLINK_COOLDOWN = 0.3
BLINK_DISPLAY_DURATION = 0.2
BLINK_MIN_EAR_DROP = 0.19
BLINK_MIN_ABSOLUTE_EAR_DROP = 0.03
BLINK_DURATION_MIN = 0.1
BLINK_DURATION_MAX = 0.6
BLINK_RECOVERY_THRESHOLD = 0.7
BASELINE_WINDOW_SIZE = 15


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


class BlinkDetectionState:
    def __init__(self):
        self.baseline_ear_values = deque(maxlen=BASELINE_WINDOW_SIZE)
        self.current_baseline_ear = 0.0
        self.blink_in_progress = False
        self.blink_start_time = 0.0
        self.last_blink_time = 0.0
        self.baseline_smoothing_factor = 0.3
        self.max_drop_percentage = 0.0

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

    def detect(self, current_ear, current_time):
        self.baseline_ear_values.append(current_ear)

        if len(self.baseline_ear_values) >= 5:
            new_baseline = self.calculate_baseline_ear(self.baseline_ear_values)
            if new_baseline:
                if self.current_baseline_ear > 0:
                    self.current_baseline_ear = (
                        self.baseline_smoothing_factor * new_baseline
                        + (1 - self.baseline_smoothing_factor)
                        * self.current_baseline_ear
                    )
                else:
                    self.current_baseline_ear = new_baseline
        else:
            return False, None

        if self.current_baseline_ear <= 0:
            return False, None

        ear_drop_percentage = (
            self.current_baseline_ear - current_ear
        ) / self.current_baseline_ear
        ear_drop_absolute = self.current_baseline_ear - current_ear
        adaptive_threshold = get_adaptive_ear_drop_threshold(
            self.current_baseline_ear
        )

        if (
            not self.blink_in_progress
            and ear_drop_percentage > adaptive_threshold
            and ear_drop_absolute > BLINK_MIN_ABSOLUTE_EAR_DROP
            and ear_drop_percentage > 0
        ):
            self.blink_in_progress = True
            self.blink_start_time = current_time
            self.max_drop_percentage = ear_drop_percentage
            return False, {
                "baseline": self.current_baseline_ear,
                "drop": ear_drop_percentage,
                "phase": "start",
                "threshold": adaptive_threshold,
            }

        if self.blink_in_progress:
            if ear_drop_percentage > self.max_drop_percentage:
                self.max_drop_percentage = ear_drop_percentage

            blink_duration = current_time - self.blink_start_time
            if (
                current_ear
                > self.current_baseline_ear * BLINK_RECOVERY_THRESHOLD
                or blink_duration > BLINK_DURATION_MAX
            ):
                if (
                    BLINK_DURATION_MIN <= blink_duration <= BLINK_DURATION_MAX
                    and self.max_drop_percentage > adaptive_threshold
                    and self.current_baseline_ear * self.max_drop_percentage
                    > BLINK_MIN_ABSOLUTE_EAR_DROP
                ):
                    if current_time - self.last_blink_time > BLINK_COOLDOWN:
                        self.last_blink_time = current_time
                        self.blink_in_progress = False
                        max_drop_ear = self.current_baseline_ear * (
                            1 - self.max_drop_percentage
                        )
                        return True, {
                            "baseline": self.current_baseline_ear,
                            "drop": self.max_drop_percentage,
                            "max_drop_ear": max_drop_ear,
                            "duration": blink_duration,
                            "phase": "complete",
                            "threshold": adaptive_threshold,
                        }

                self.blink_in_progress = False
                self.max_drop_percentage = 0.0

        return False, {
            "baseline": self.current_baseline_ear,
            "drop": ear_drop_percentage,
            "phase": "monitoring",
            "threshold": adaptive_threshold,
        }

    def reset(self):
        self.baseline_ear_values.clear()
        self.current_baseline_ear = 0.0
        self.blink_in_progress = False
        self.blink_start_time = 0.0
        self.last_blink_time = 0.0
        self.baseline_smoothing_factor = 0.3
        self.max_drop_percentage = 0.0
