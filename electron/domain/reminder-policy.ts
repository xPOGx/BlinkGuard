export const REMINDER_POPUP_VISIBLE_MS = 2500;
export const CAMERA_POLL_INTERVAL_MS = 100;
/** Continuous healthy ready-BPM before FR-7 streak cheer. */
export const STREAK_CHEER_HEALTHY_MS = 10 * 60 * 1000;
/** In-memory cooldown after a streak cheer (resets on process restart). */
export const STREAK_CHEER_COOLDOWN_MS = 30 * 60 * 1000;
/** Main-process debounce for sidecar blink credits (pairs with Python ~300ms cooldown). */
export const BLINK_CREDIT_DEBOUNCE_MS = 150;
/** Default snooze duration (matches DEFAULT_PREFERENCES.snoozeMinutes). */
export function promptSnoozeMs(minutes: number): number {
	return Math.max(1, minutes) * 60 * 1000;
}
/** Shared default snooze duration for blink / exercise / look-away prompts. */
export const PROMPT_SNOOZE_MS = promptSnoozeMs(5);
/** How long blink reminder popups stay suppressed after Snooze (default). */
export const BLINK_SNOOZE_MS = PROMPT_SNOOZE_MS;
/** Auto-dismiss for exercise overlay when not skipped sooner. */
export const EXERCISE_POPUP_VISIBLE_MS = 30_000;
/** Debounce before treating no-face as confirmed (also arms auto-stop). */
export const NO_FACE_DEBOUNCE_MS = 750;
/** Debounce before hiding the no-face toast / crediting face-return. */
export const FACE_RETURN_DEBOUNCE_MS = 500;

export type BlinkCreditSource =
	| "detected"
	| "face-return"
	| "camera-ready"
	| "sleep";

/**
 * Cadence for timer / MGD setInterval ticks.
 * No longer adds {@link REMINDER_POPUP_VISIBLE_MS} — blink cues stay until
 * blink/snooze/replace rather than auto-dismissing at 2.5s.
 */
export function nextTimerReminderDelay(intervalMs: number): number {
	return Math.max(0, intervalMs);
}

export function autoStopNoFaceDelayMs(minutes: number): number {
	return Math.max(1, minutes) * 60 * 1000;
}

export function shouldArmAutoStopOnNoFace(input: {
	isTracking: boolean;
	cameraEnabled: boolean;
	autoStopNoFaceEnabled: boolean;
	cameraSoftPaused: boolean;
}): boolean {
	return (
		input.isTracking &&
		input.cameraEnabled &&
		input.autoStopNoFaceEnabled &&
		!input.cameraSoftPaused
	);
}

export function shouldShowCameraReminder(input: {
	isTracking: boolean;
	isDetectorRunning: boolean;
	isFaceDetected: boolean;
	hasPopup: boolean;
	timeSinceLastBlinkMs: number;
	timeSinceLastReminderMs: number;
	reminderIntervalMs: number;
}): boolean {
	return (
		input.isTracking &&
		input.isDetectorRunning &&
		input.isFaceDetected &&
		!input.hasPopup &&
		input.timeSinceLastBlinkMs >= input.reminderIntervalMs &&
		input.timeSinceLastReminderMs >= input.reminderIntervalMs
	);
}
