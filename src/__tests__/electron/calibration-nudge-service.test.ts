import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CalibrationNudgeService } from "../../../electron/application/calibration-nudge-service";
import type { PreferenceStore } from "../../../electron/application/ports/preference-store";
import type { CalibrationNudgeWindowPort } from "../../../electron/application/ports/runtime-ports";
import { PreferencesService } from "../../../electron/application/preferences-service";
import { CALIBRATION_NUDGE_COOLDOWN_MS } from "../../../electron/domain/calibration-freshness";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";

class FakeStore implements PreferenceStore {
	private readonly data = new Map<string, unknown>();

	get<T>(key: string, defaultValue?: T): T {
		if (this.data.has(key)) return this.data.get(key) as T;
		return defaultValue as T;
	}

	set<T>(key: string, value: T): void {
		this.data.set(key, value);
	}

	has(key: string): boolean {
		return this.data.has(key);
	}

	clear(): void {
		this.data.clear();
	}
}

function createWindows(): CalibrationNudgeWindowPort {
	return {
		showCalibrationNudge: vi.fn(),
		hideCalibrationNudge: vi.fn(),
		hasCalibrationNudge: vi.fn(() => false),
		hasBlinkRateCoach: vi.fn(() => false),
		hasReminder: vi.fn(() => false),
		hasNoFace: vi.fn(() => false),
		sendToMain: vi.fn(),
	};
}

describe("CalibrationNudgeService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(1_700_000_000_000);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows a stale toast once per cooldown while tracking", () => {
		const store = new FakeStore();
		store.set("earCalibration", 0.28);
		store.set("cameraEnabled", true);
		store.set("isTracking", true);
		const preferences = new PreferencesService(store);
		const windows = createWindows();
		const service = new CalibrationNudgeService(preferences, windows);

		service.start();
		expect(windows.showCalibrationNudge).toHaveBeenCalledWith("stale");
		expect(windows.sendToMain).toHaveBeenCalledWith(
			IPC_CHANNELS.calibrationNudge,
			{ reason: "stale" },
		);

		(windows.showCalibrationNudge as ReturnType<typeof vi.fn>).mockClear();
		service.evaluate();
		expect(windows.showCalibrationNudge).not.toHaveBeenCalled();

		vi.setSystemTime(1_700_000_000_000 + CALIBRATION_NUDGE_COOLDOWN_MS);
		service.evaluate();
		expect(windows.showCalibrationNudge).toHaveBeenCalledWith("stale");
		service.dispose();
	});

	it("does not show a toast when the notification gate is closed", () => {
		const store = new FakeStore();
		store.set("earCalibration", 0.28);
		store.set("cameraEnabled", true);
		store.set("isTracking", true);
		const preferences = new PreferencesService(store);
		const windows = createWindows();
		const service = new CalibrationNudgeService(preferences, windows, {
			notificationsAllowed: () => false,
			pauseReason: () => "fullscreen",
		});

		service.start();
		expect(windows.showCalibrationNudge).not.toHaveBeenCalled();
		expect(windows.sendToMain).toHaveBeenCalledWith(
			IPC_CHANNELS.calibrationNudge,
			{ reason: "stale" },
		);
		service.dispose();
	});

	it("records drift without persisting the nudged EAR", () => {
		const store = new FakeStore();
		store.set("earCalibration", 0.28);
		store.set("calibrationAt", Date.now());
		store.set("cameraEnabled", true);
		store.set("isTracking", true);
		const preferences = new PreferencesService(store);
		const windows = createWindows();
		const service = new CalibrationNudgeService(preferences, windows);
		const earBefore = preferences.current.earCalibration;

		service.start();
		(windows.showCalibrationNudge as ReturnType<typeof vi.fn>).mockClear();
		service.onDriftNudge(Date.now());

		expect(preferences.current.earCalibration).toBe(earBefore);
		expect(preferences.current.lastBaselineDriftAt).toBe(Date.now());
		expect(windows.showCalibrationNudge).toHaveBeenCalledWith("drift");
		service.dispose();
	});

	it("clears drift and snooze after a successful calibration update", () => {
		const store = new FakeStore();
		store.set("earCalibration", 0.28);
		store.set("lastBaselineDriftAt", 1);
		store.set("calibrationNudgeDismissedAt", 2);
		store.set("cameraEnabled", true);
		store.set("isTracking", true);
		const preferences = new PreferencesService(store);
		const windows = createWindows();
		const service = new CalibrationNudgeService(preferences, windows);

		preferences.set("calibrationAt", Date.now());
		service.onCalibrationUpdated();

		expect(preferences.current.lastBaselineDriftAt).toBeNull();
		expect(preferences.current.calibrationNudgeDismissedAt).toBeNull();
		expect(windows.hideCalibrationNudge).toHaveBeenCalled();
		expect(windows.sendToMain).toHaveBeenCalledWith(
			IPC_CHANNELS.calibrationNudge,
			{ reason: null },
		);
		service.dispose();
	});

	it("dismiss snoozes the banner and toast", () => {
		const store = new FakeStore();
		store.set("earCalibration", 0.28);
		store.set("cameraEnabled", true);
		store.set("isTracking", true);
		const preferences = new PreferencesService(store);
		const windows = createWindows();
		const service = new CalibrationNudgeService(preferences, windows);
		service.start();
		(windows.showCalibrationNudge as ReturnType<typeof vi.fn>).mockClear();

		service.dismiss();
		expect(preferences.current.calibrationNudgeDismissedAt).toBe(Date.now());
		expect(windows.hideCalibrationNudge).toHaveBeenCalled();
		service.evaluate();
		expect(windows.showCalibrationNudge).not.toHaveBeenCalled();
		service.dispose();
	});
});
