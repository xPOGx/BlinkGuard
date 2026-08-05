import { describe, expect, it } from "vitest";
import {
	CAMERA_POLL_INTERVAL_MS,
	REMINDER_POPUP_VISIBLE_MS,
	nextTimerReminderDelay,
	shouldShowCameraReminder,
} from "../../../electron/domain/reminder-policy";

describe("reminder-policy", () => {
	it("adds popup visible duration to the timer reminder delay", () => {
		expect(nextTimerReminderDelay(3000)).toBe(3000 + REMINDER_POPUP_VISIBLE_MS);
		expect(REMINDER_POPUP_VISIBLE_MS).toBe(2500);
		expect(CAMERA_POLL_INTERVAL_MS).toBe(100);
	});

	it("shows a camera reminder only when all gates pass", () => {
		const ready = {
			isTracking: true,
			isDetectorRunning: true,
			isFaceDetected: true,
			hasPopup: false,
			timeSinceLastBlinkMs: 3000,
			reminderIntervalMs: 3000,
		};

		expect(shouldShowCameraReminder(ready)).toBe(true);
	});

	it.each([
		["not tracking", { isTracking: false }],
		["detector stopped", { isDetectorRunning: false }],
		["no face", { isFaceDetected: false }],
		["popup already open", { hasPopup: true }],
		["blink too recent", { timeSinceLastBlinkMs: 2999 }],
	] as const)("blocks when %s", (_label, override) => {
		expect(
			shouldShowCameraReminder({
				isTracking: true,
				isDetectorRunning: true,
				isFaceDetected: true,
				hasPopup: false,
				timeSinceLastBlinkMs: 3000,
				reminderIntervalMs: 3000,
				...override,
			}),
		).toBe(false);
	});
});
