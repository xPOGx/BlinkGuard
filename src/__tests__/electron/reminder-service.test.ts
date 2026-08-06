import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRuntimeState } from "../../../electron/application/app-runtime-state";
import { ReminderService } from "../../../electron/application/reminder-service";
import type {
	BlinkDetectorPort,
	NotificationSoundPort,
	ReminderWindowPort,
} from "../../../electron/application/ports/runtime-ports";
import {
	BLINK_CREDIT_DEBOUNCE_MS,
	REMINDER_POPUP_VISIBLE_MS,
} from "../../../electron/domain/reminder-policy";
import {
	DEFAULT_PREFERENCES,
	type AppPreferences,
} from "../../../shared/preferences";

function createPreferences(
	overrides: Partial<AppPreferences> = {},
): AppPreferences {
	return {
		...DEFAULT_PREFERENCES,
		isTracking: true,
		cameraEnabled: true,
		mgdMode: false,
		reminderInterval: 3000,
		...overrides,
	};
}

function createWindows(): ReminderWindowPort & {
	reminderOpen: boolean;
	lastPopup: unknown;
} {
	const api = {
		reminderOpen: false,
		lastPopup: null as unknown,
		showReminder: vi.fn((_kind: "starting" | "blink" | "stopped") => {
			api.reminderOpen = true;
			api.lastPopup = { id: Math.random() };
			return api.lastPopup;
		}),
		closeReminder: vi.fn(() => {
			api.reminderOpen = false;
		}),
		closeReminderIfCurrent: vi.fn((token: unknown) => {
			if (token === api.lastPopup) {
				api.reminderOpen = false;
				return true;
			}
			return false;
		}),
		hasReminder: vi.fn(() => api.reminderOpen),
		showNoFace: vi.fn(),
		hideNoFace: vi.fn(),
		hasNoFace: vi.fn(() => false),
		closeCamera: vi.fn(),
		sendToMain: vi.fn(),
		sendPreferences: vi.fn(),
	};
	return api;
}

function createSidecar(
	overrides: Partial<BlinkDetectorPort> = {},
): BlinkDetectorPort {
	return {
		isRunning: true,
		isCameraReady: true,
		start: vi.fn(),
		startCamera: vi.fn(() => true),
		stopCamera: vi.fn(),
		markCameraUnavailable: vi.fn(),
		...overrides,
	};
}

function createSound(): NotificationSoundPort {
	return { play: vi.fn() };
}

describe("ReminderService credit semantics", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("creditBlink sources update lastBlinkTime but not lastReminderShownAt", () => {
		const preferences = createPreferences();
		const state = new AppRuntimeState();
		const windows = createWindows();
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar(),
			createSound(),
		);

		const blinkBefore = state.lastBlinkTime;
		const reminderBefore = state.lastReminderShownAt;
		vi.advanceTimersByTime(500);

		expect(service.creditBlink("face-return")).toBe(true);
		expect(state.lastBlinkTime).toBeGreaterThan(blinkBefore);
		expect(state.lastReminderShownAt).toBe(reminderBefore);

		const afterFace = state.lastBlinkTime;
		vi.advanceTimersByTime(500);
		expect(service.creditBlink("camera-ready")).toBe(true);
		expect(state.lastBlinkTime).toBeGreaterThan(afterFace);
		expect(state.lastReminderShownAt).toBe(reminderBefore);

		const afterCamera = state.lastBlinkTime;
		vi.advanceTimersByTime(500);
		expect(service.creditBlink("sleep")).toBe(true);
		expect(state.lastBlinkTime).toBeGreaterThan(afterCamera);
		expect(state.lastReminderShownAt).toBe(reminderBefore);
	});

	it("onBlink debounces detected credits within BLINK_CREDIT_DEBOUNCE_MS", () => {
		const preferences = createPreferences();
		const state = new AppRuntimeState();
		const windows = createWindows();
		windows.reminderOpen = true;
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar(),
			createSound(),
		);

		service.onBlink();
		const first = state.lastBlinkTime;
		expect(windows.closeReminder).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(BLINK_CREDIT_DEBOUNCE_MS - 1);
		service.onBlink();
		expect(state.lastBlinkTime).toBe(first);
		expect(windows.closeReminder).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1);
		service.onBlink();
		expect(state.lastBlinkTime).toBeGreaterThan(first);
		expect(windows.closeReminder).toHaveBeenCalledTimes(2);
	});

	it("auto-dismiss updates lastReminderShownAt only", () => {
		const preferences = createPreferences({ reminderInterval: 1000 });
		const state = new AppRuntimeState();
		state.isFaceDetected = true;
		state.lastBlinkTime = Date.now() - 5000;
		state.lastReminderShownAt = Date.now() - 5000;
		const windows = createWindows();
		const sidecar = createSidecar();
		const sound = createSound();
		const service = new ReminderService(
			preferences,
			state,
			windows,
			sidecar,
			sound,
		);

		// Drive face-aware loop via sync (camera already ready).
		service.syncCameraLoopForMgdMode();
		expect(state.cameraMonitoringInterval).not.toBeNull();

		vi.advanceTimersByTime(100);
		expect(windows.showReminder).toHaveBeenCalledWith("blink");
		const blinkAtShow = state.lastBlinkTime;
		const reminderAtShow = state.lastReminderShownAt;

		vi.advanceTimersByTime(REMINDER_POPUP_VISIBLE_MS);
		expect(state.lastBlinkTime).toBe(blinkAtShow);
		expect(state.lastReminderShownAt).toBeGreaterThan(reminderAtShow);
	});

	it("syncCameraLoopForMgdMode restarts the MGD loop mid-session", () => {
		const preferences = createPreferences({ mgdMode: false });
		const state = new AppRuntimeState();
		state.isFaceDetected = true;
		const windows = createWindows();
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar(),
			createSound(),
		);

		service.syncCameraLoopForMgdMode();
		expect(state.cameraMonitoringInterval).not.toBeNull();
		expect(state.mgdReminderLoopActive).toBe(false);

		preferences.mgdMode = true;
		service.syncCameraLoopForMgdMode();
		expect(state.cameraMonitoringInterval).toBeNull();
		expect(state.mgdReminderLoopActive).toBe(true);
		expect(state.blinkInterval).not.toBeNull();
	});

	it("markReminderShown does not touch lastBlinkTime", () => {
		const state = new AppRuntimeState();
		const service = new ReminderService(
			createPreferences(),
			state,
			createWindows(),
			createSidecar(),
			createSound(),
		);
		const blinkBefore = state.lastBlinkTime;
		vi.advanceTimersByTime(200);
		service.markReminderShown();
		expect(state.lastBlinkTime).toBe(blinkBefore);
		expect(state.lastReminderShownAt).toBeGreaterThan(blinkBefore);
	});
});
