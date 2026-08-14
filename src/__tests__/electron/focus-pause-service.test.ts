import { describe, expect, it, vi } from "vitest";
import { FocusPauseService } from "../../../electron/application/focus-pause-service";
import { DEFAULT_PREFERENCES } from "../../../shared/preferences";

function hoursWindowContainingNow(): { start: string; end: string } {
	const now = new Date();
	const start = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	const endHour = (now.getHours() + 1) % 24;
	const end = `${String(endHour).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
	return { start, end };
}

function makeService(
	prefs: Partial<typeof DEFAULT_PREFERENCES> = {},
	supported = true,
) {
	const sendToMain = vi.fn();
	const closeReminder = vi.fn();
	const closeExercise = vi.fn();
	const closeLookAway = vi.fn();
	const hideNoFace = vi.fn();
	const hideBlinkRateCoach = vi.fn();
	const pauseCameraForFocus = vi.fn();
	const resumeCameraIfNeeded = vi.fn();
	const service = new FocusPauseService(
		{
			...DEFAULT_PREFERENCES,
			quietHoursEnabled: false,
			cameraEnabled: true,
			isTracking: true,
			...prefs,
		},
		{
			closeReminder,
			closeExercise,
			closeLookAway,
			hideNoFace,
			hideBlinkRateCoach,
			sendToMain,
		},
		{ pauseCameraForFocus, resumeCameraIfNeeded } as never,
		"focus-pause-state",
		supported,
	);
	return {
		service,
		sendToMain,
		closeReminder,
		closeExercise,
		pauseCameraForFocus,
		resumeCameraIfNeeded,
	};
}

describe("FocusPauseService pushState", () => {
	it("includes fullscreenDetectionSupported in the payload", () => {
		const { service, sendToMain } = makeService({}, false);

		service.pushState();

		expect(sendToMain).toHaveBeenCalledWith("focus-pause-state", {
			reason: null,
			fullscreenDetectionSupported: false,
		});
	});
});

describe("FocusPauseService app-rule / fullscreen / quiet hours", () => {
	it("pauses popups and camera on an app-rule match", () => {
		const { service, closeReminder, pauseCameraForFocus, sendToMain } =
			makeService({
				pauseAppRules: [{ processName: "Zoom.exe", windowTitle: "" }],
			});

		service.setForeground({
			isFullscreen: false,
			processName: "Zoom.exe",
			windowTitle: "Zoom Meeting",
		});

		expect(service.pauseReason()).toBe("app-rule");
		expect(service.notificationsAllowed()).toBe(false);
		expect(closeReminder).toHaveBeenCalled();
		expect(pauseCameraForFocus).toHaveBeenCalled();
		expect(sendToMain).toHaveBeenCalledWith("focus-pause-state", {
			reason: "app-rule",
			fullscreenDetectionSupported: true,
		});
	});

	it("does not pause when the foreground misses the blocklist", () => {
		const { service, closeReminder, pauseCameraForFocus } = makeService({
			pauseAppRules: [{ processName: "Zoom.exe", windowTitle: "" }],
		});

		service.setForeground({
			isFullscreen: false,
			processName: "chrome.exe",
			windowTitle: "Docs",
		});

		expect(service.pauseReason()).toBeNull();
		expect(service.notificationsAllowed()).toBe(true);
		expect(closeReminder).not.toHaveBeenCalled();
		expect(pauseCameraForFocus).not.toHaveBeenCalled();
	});

	it("resumes the camera when leaving an app-rule match", () => {
		const { service, pauseCameraForFocus, resumeCameraIfNeeded } = makeService({
			pauseAppRules: [{ processName: "zoom", windowTitle: "" }],
		});

		service.setForeground({
			isFullscreen: false,
			processName: "Zoom.exe",
			windowTitle: "",
		});
		expect(pauseCameraForFocus).toHaveBeenCalledTimes(1);

		service.setForeground({
			isFullscreen: false,
			processName: "Code.exe",
			windowTitle: "BlinkGuard",
		});
		expect(resumeCameraIfNeeded).toHaveBeenCalledTimes(1);
		expect(service.pauseReason()).toBeNull();
	});

	it("keeps the camera running during quiet hours", () => {
		const { start, end } = hoursWindowContainingNow();
		const { service, pauseCameraForFocus, closeReminder } = makeService({
			quietHoursEnabled: true,
			quietHoursStart: start,
			quietHoursEnd: end,
		});

		service.recompute();

		expect(service.pauseReason()).toBe("quiet-hours");
		expect(closeReminder).toHaveBeenCalled();
		expect(pauseCameraForFocus).not.toHaveBeenCalled();
	});

	it("soft-pauses the camera on fullscreen", () => {
		const { service, pauseCameraForFocus } = makeService();

		service.setFullscreen(true);

		expect(service.pauseReason()).toBe("fullscreen");
		expect(pauseCameraForFocus).toHaveBeenCalled();
	});
});

describe("FocusPauseService lastExternalForeground", () => {
	it("keeps the last process-only identity when BlinkGuard-focused probes are empty", () => {
		const { service } = makeService();

		service.setForeground({
			isFullscreen: false,
			processName: "Zoom.exe",
			windowTitle: "Zoom Meeting",
		});
		expect(service.lastExternalForeground()).toEqual({
			processName: "Zoom.exe",
			windowTitle: "",
		});

		service.setForeground({
			isFullscreen: false,
			processName: null,
			windowTitle: null,
		});
		expect(service.lastExternalForeground()).toEqual({
			processName: "Zoom.exe",
			windowTitle: "",
		});
	});
});
