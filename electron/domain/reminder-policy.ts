export const REMINDER_POPUP_VISIBLE_MS = 2500;
export const CAMERA_POLL_INTERVAL_MS = 100;
/** Main-process debounce for sidecar blink credits (pairs with Python ~300ms cooldown). */
export const BLINK_CREDIT_DEBOUNCE_MS = 150;
/** How long blink reminder popups stay suppressed after Snooze. */
export const BLINK_SNOOZE_MS = 5 * 60 * 1000;
/** Debounce before treating no-face as confirmed (also arms auto-stop). */
export const NO_FACE_DEBOUNCE_MS = 750;

export type BlinkCreditSource =
	| "detected"
	| "face-return"
	| "camera-ready"
	| "sleep";

export function nextTimerReminderDelay(reminderIntervalMs: number): number {
	return reminderIntervalMs + REMINDER_POPUP_VISIBLE_MS;
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
