/** Minimum gap between soft blink-rate coach toasts. */
export const BLINK_RATE_COACH_COOLDOWN_MS = 15 * 60_000;
/** Auto-dismiss for the soft blink-rate coach toast. */
export const BLINK_RATE_COACH_DISMISS_MS = 5_000;

export type BlinkRateCoachInput = {
	enabled: boolean;
	cameraEnabled: boolean;
	isTracking: boolean;
	blinkRateReady: boolean;
	blinksPerMinute: number;
	thresholdPerMin: number;
	lastShownAt: number;
	now: number;
	notificationsAllowed: boolean;
	/** Blink reminder, no-face, or an already-open coach toast. */
	hasBlockingToast: boolean;
};

/**
 * Soft coaching only when camera tracking has a ready live BPM below threshold.
 * Timer-only mode must never pass `cameraEnabled: true` here.
 */
export function shouldShowBlinkRateCoach(input: BlinkRateCoachInput): boolean {
	if (!input.enabled) return false;
	if (!input.cameraEnabled || !input.isTracking) return false;
	if (!input.blinkRateReady) return false;
	if (!input.notificationsAllowed) return false;
	if (input.hasBlockingToast) return false;
	if (
		!Number.isFinite(input.blinksPerMinute) ||
		!Number.isFinite(input.thresholdPerMin)
	) {
		return false;
	}
	if (input.blinksPerMinute >= input.thresholdPerMin) return false;
	if (
		input.lastShownAt > 0 &&
		input.now - input.lastShownAt < BLINK_RATE_COACH_COOLDOWN_MS
	) {
		return false;
	}
	return true;
}
