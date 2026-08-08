import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRuntimeState } from "../../../electron/application/app-runtime-state";
import type { PreferenceStore } from "../../../electron/application/ports/preference-store";
import type {
	BlinkDetectorPort,
	NotificationSoundPort,
	ReminderWindowPort,
} from "../../../electron/application/ports/runtime-ports";
import { ReminderService } from "../../../electron/application/reminder-service";
import {
	BLINK_CREDIT_DEBOUNCE_MS,
	BLINK_SNOOZE_MS,
	NO_FACE_DEBOUNCE_MS,
	nextTimerReminderDelay,
	REMINDER_POPUP_VISIBLE_MS,
} from "../../../electron/domain/reminder-policy";
import {
	type AppPreferences,
	DEFAULT_PREFERENCES,
} from "../../../shared/preferences";

function createStore(): PreferenceStore {
	const data = new Map<string, unknown>();
	return {
		get<T>(key: string, defaultValue?: T): T {
			if (data.has(key)) return data.get(key) as T;
			return defaultValue as T;
		},
		set<T>(key: string, value: T): void {
			data.set(key, value);
		},
		has(key: string): boolean {
			return data.has(key);
		},
		clear(): void {
			data.clear();
		},
	};
}

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
		showBlinkRateCoach: vi.fn(),
		hideBlinkRateCoach: vi.fn(),
		hasBlinkRateCoach: vi.fn(() => false),
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
			createStore(),
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
		const stats = {
			recordBlink: vi.fn(),
			onTrackingStart: vi.fn(),
			onTrackingStop: vi.fn(),
		};
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar(),
			createSound(),
			createStore(),
			stats,
		);

		expect(service.onBlink()).toBe(true);
		const first = state.lastBlinkTime;
		expect(windows.closeReminder).toHaveBeenCalledTimes(1);
		expect(stats.recordBlink).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(BLINK_CREDIT_DEBOUNCE_MS - 1);
		expect(service.onBlink()).toBe(false);
		expect(state.lastBlinkTime).toBe(first);
		expect(windows.closeReminder).toHaveBeenCalledTimes(1);
		expect(stats.recordBlink).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1);
		expect(service.onBlink()).toBe(true);
		expect(state.lastBlinkTime).toBeGreaterThan(first);
		expect(windows.closeReminder).toHaveBeenCalledTimes(2);
		expect(stats.recordBlink).toHaveBeenCalledTimes(2);
	});

	it("start and stop notify blink stats for tracking sessions", () => {
		const preferences = createPreferences({
			isTracking: false,
			cameraEnabled: false,
		});
		const state = new AppRuntimeState();
		const stats = {
			recordBlink: vi.fn(),
			onTrackingStart: vi.fn(),
			onTrackingStop: vi.fn(),
		};
		const service = new ReminderService(
			preferences,
			state,
			createWindows(),
			createSidecar({ isRunning: false, isCameraReady: false }),
			createSound(),
			createStore(),
			stats,
		);

		service.start(3000);
		expect(stats.onTrackingStart).toHaveBeenCalledTimes(1);
		expect(preferences.isTracking).toBe(true);

		service.ensureStopped();
		expect(stats.onTrackingStop).toHaveBeenCalledTimes(1);
		expect(preferences.isTracking).toBe(false);
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
			createStore(),
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
			createStore(),
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
			createStore(),
		);
		const blinkBefore = state.lastBlinkTime;
		vi.advanceTimersByTime(200);
		service.markReminderShown();
		expect(state.lastBlinkTime).toBe(blinkBefore);
		expect(state.lastReminderShownAt).toBeGreaterThan(blinkBefore);
	});

	it("snooze suppresses blink popups for 5 minutes then resumes", () => {
		const preferences = createPreferences({
			isTracking: false,
			cameraEnabled: false,
			reminderInterval: 3000,
		});
		const state = new AppRuntimeState();
		const windows = createWindows();
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar({ isRunning: false, isCameraReady: false }),
			createSound(),
			createStore(),
		);

		service.start(3000);
		expect(windows.showReminder).toHaveBeenCalledWith("blink");
		expect(windows.showReminder).toHaveBeenCalledTimes(1);

		service.snooze();
		expect(windows.closeReminder).toHaveBeenCalled();
		expect(state.blinkSnoozeUntil).toBeGreaterThan(Date.now());
		windows.showReminder.mockClear();

		vi.advanceTimersByTime(BLINK_SNOOZE_MS - 1);
		expect(windows.showReminder).not.toHaveBeenCalled();

		vi.advanceTimersByTime(1 + nextTimerReminderDelay(3000));
		expect(windows.showReminder).toHaveBeenCalledWith("blink");
		expect(state.blinkSnoozeUntil).toBe(0);
	});

	it("snooze does not forge blink credit; onBlink still works", () => {
		const preferences = createPreferences({
			isTracking: false,
			cameraEnabled: false,
		});
		const state = new AppRuntimeState();
		const windows = createWindows();
		const stats = {
			recordBlink: vi.fn(),
			onTrackingStart: vi.fn(),
			onTrackingStop: vi.fn(),
		};
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar({ isRunning: false, isCameraReady: false }),
			createSound(),
			createStore(),
			stats,
		);

		service.start(3000);
		const blinkBefore = state.lastBlinkTime;
		vi.advanceTimersByTime(200);

		service.snooze();
		expect(stats.recordBlink).not.toHaveBeenCalled();
		expect(state.lastBlinkTime).toBe(blinkBefore);
		expect(state.lastReminderShownAt).toBeGreaterThan(blinkBefore);

		expect(service.onBlink()).toBe(true);
		expect(stats.recordBlink).toHaveBeenCalledTimes(1);
		expect(state.lastBlinkTime).toBeGreaterThan(blinkBefore);
		expect(windows.closeReminder).toHaveBeenCalled();
	});
});

describe("ReminderService auto-stop on no face", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("stops tracking and sends preferences after N minutes without a face", () => {
		const preferences = createPreferences({
			autoStopNoFaceEnabled: true,
			autoStopNoFaceMinutes: 2,
		});
		const state = new AppRuntimeState();
		const windows = createWindows();
		const store = createStore();
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar(),
			createSound(),
			store,
		);

		service.onFaceDetection(false);
		vi.advanceTimersByTime(NO_FACE_DEBOUNCE_MS);
		expect(state.noFaceAutoStopTimer).not.toBeNull();
		expect(windows.showNoFace).toHaveBeenCalled();

		vi.advanceTimersByTime(2 * 60 * 1000 - 1);
		expect(preferences.isTracking).toBe(true);

		vi.advanceTimersByTime(1);
		expect(preferences.isTracking).toBe(false);
		expect(store.get("isTracking")).toBe(false);
		expect(windows.showReminder).toHaveBeenCalledWith("stopped");
		expect(windows.sendPreferences).toHaveBeenCalled();
		expect(state.noFaceAutoStopTimer).toBeNull();
	});

	it("cancels auto-stop when the face returns before the timeout", () => {
		const preferences = createPreferences({
			autoStopNoFaceEnabled: true,
			autoStopNoFaceMinutes: 2,
		});
		const state = new AppRuntimeState();
		const windows = createWindows();
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar(),
			createSound(),
			createStore(),
		);

		service.onFaceDetection(false);
		vi.advanceTimersByTime(NO_FACE_DEBOUNCE_MS);
		expect(state.noFaceAutoStopTimer).not.toBeNull();

		service.onFaceDetection(true);
		expect(state.noFaceAutoStopTimer).toBeNull();
		expect(state.isFaceDetected).toBe(true);

		vi.advanceTimersByTime(2 * 60 * 1000);
		expect(preferences.isTracking).toBe(true);
		expect(windows.sendPreferences).not.toHaveBeenCalled();
	});

	it("does not arm auto-stop when the feature is disabled", () => {
		const preferences = createPreferences({
			autoStopNoFaceEnabled: false,
			autoStopNoFaceMinutes: 2,
		});
		const state = new AppRuntimeState();
		const windows = createWindows();
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar(),
			createSound(),
			createStore(),
		);

		service.onFaceDetection(false);
		vi.advanceTimersByTime(NO_FACE_DEBOUNCE_MS);
		expect(state.noFaceAutoStopTimer).toBeNull();
		expect(preferences.isTracking).toBe(true);

		vi.advanceTimersByTime(2 * 60 * 1000);
		expect(preferences.isTracking).toBe(true);
		expect(windows.sendPreferences).not.toHaveBeenCalled();
	});

	it("cancels a pending auto-stop when soft-pausing for focus", () => {
		const preferences = createPreferences({
			autoStopNoFaceEnabled: true,
			autoStopNoFaceMinutes: 2,
		});
		const state = new AppRuntimeState();
		const windows = createWindows();
		const service = new ReminderService(
			preferences,
			state,
			windows,
			createSidecar(),
			createSound(),
			createStore(),
		);

		service.onFaceDetection(false);
		vi.advanceTimersByTime(NO_FACE_DEBOUNCE_MS);
		expect(state.noFaceAutoStopTimer).not.toBeNull();

		service.pauseCameraForFocus();
		expect(state.noFaceAutoStopTimer).toBeNull();
		expect(service.isCameraSoftPaused).toBe(true);

		vi.advanceTimersByTime(2 * 60 * 1000);
		expect(preferences.isTracking).toBe(true);
		expect(windows.sendPreferences).not.toHaveBeenCalled();
	});
});
