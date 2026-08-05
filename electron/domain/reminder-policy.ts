export const REMINDER_POPUP_VISIBLE_MS = 2500;
export const CAMERA_POLL_INTERVAL_MS = 100;

export function nextTimerReminderDelay(reminderIntervalMs: number): number {
	return reminderIntervalMs + REMINDER_POPUP_VISIBLE_MS;
}

export function shouldShowCameraReminder(input: {
	isTracking: boolean;
	isDetectorRunning: boolean;
	isFaceDetected: boolean;
	hasPopup: boolean;
	timeSinceLastBlinkMs: number;
	reminderIntervalMs: number;
}): boolean {
	return (
		input.isTracking &&
		input.isDetectorRunning &&
		input.isFaceDetected &&
		!input.hasPopup &&
		input.timeSinceLastBlinkMs >= input.reminderIntervalMs
	);
}
