import { describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../../../electron/application/ports/preference-store";
import { PreferenceActions } from "../../../electron/application/preference-actions";
import { PreferencesService } from "../../../electron/application/preferences-service";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";

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

function createActions(
	preferences: PreferencesService,
	overrides: {
		reminders?: object;
		exercises?: object;
		lookAway?: object;
		focusPause?: object;
		blinkStats?: object;
		windows?: object;
		sidecar?: object;
		shortcuts?: object;
		applyLaunchAtLogin?: (enabled: boolean) => void;
		tray?: object;
	} = {},
) {
	return new PreferenceActions(
		preferences,
		(overrides.reminders ?? {}) as never,
		(overrides.exercises ?? { stop: vi.fn() }) as never,
		(overrides.lookAway ?? { stop: vi.fn() }) as never,
		(overrides.focusPause ?? { recompute: vi.fn() }) as never,
		(overrides.blinkStats ?? {
			invalidateCharts: vi.fn(),
			isLivePushEnabled: () => false,
			getSnapshot: vi.fn(),
		}) as never,
		(overrides.windows ?? {
			sendPreferences: vi.fn(),
			sendToMain: vi.fn(),
			showCamera: vi.fn(),
		}) as never,
		(overrides.sidecar ?? {
			startEarCalibration: vi.fn(),
			cancelEarCalibration: vi.fn(),
			applyCameraQuality: vi.fn(),
			applyEarCalibration: vi.fn(),
			applyClassifierCalibration: vi.fn(),
		}) as never,
		(overrides.shortcuts ?? { registerAll: vi.fn() }) as never,
		overrides.applyLaunchAtLogin ?? vi.fn(),
		overrides.tray as never,
	);
}

describe("PreferenceActions", () => {
	it("startEarCalibration enables camera and starts sidecar calibration", () => {
		const preferences = new PreferencesService(createStore());
		preferences.set("cameraEnabled", false);
		const reminders = { ensureCameraActive: vi.fn() };
		const sidecar = {
			startEarCalibration: vi.fn(),
			cancelEarCalibration: vi.fn(),
			applyCameraQuality: vi.fn(),
			applyEarCalibration: vi.fn(),
			applyClassifierCalibration: vi.fn(),
		};
		const actions = createActions(preferences, { reminders, sidecar });

		actions.startEarCalibration();

		expect(preferences.current.cameraEnabled).toBe(true);
		expect(reminders.ensureCameraActive).toHaveBeenCalledOnce();
		expect(sidecar.startEarCalibration).toHaveBeenCalledOnce();
	});

	it("updateLocale is a no-op for the same locale", () => {
		const preferences = new PreferencesService(createStore());
		const tray = { rebuildMenu: vi.fn() };
		const windows = {
			sendPreferences: vi.fn(),
			sendToMain: vi.fn(),
			showCamera: vi.fn(),
		};
		const actions = createActions(preferences, { tray, windows });

		actions.updateLocale("en");

		expect(tray.rebuildMenu).not.toHaveBeenCalled();
		expect(windows.sendPreferences).not.toHaveBeenCalled();
	});

	it("updateLocale rebuilds tray and echoes preferences", () => {
		const preferences = new PreferencesService(createStore());
		const tray = { rebuildMenu: vi.fn() };
		const snapshot = { totalBlinks: 0 };
		const blinkStats = {
			invalidateCharts: vi.fn(),
			isLivePushEnabled: () => true,
			getSnapshot: vi.fn(() => snapshot),
		};
		const windows = {
			sendPreferences: vi.fn(),
			sendToMain: vi.fn(),
			showCamera: vi.fn(),
		};
		const actions = createActions(preferences, {
			tray,
			blinkStats,
			windows,
		});

		actions.updateLocale("uk");

		expect(preferences.current.locale).toBe("uk");
		expect(tray.rebuildMenu).toHaveBeenCalledWith("uk");
		expect(blinkStats.invalidateCharts).toHaveBeenCalledOnce();
		expect(windows.sendPreferences).toHaveBeenCalledOnce();
		expect(windows.sendToMain).toHaveBeenCalledWith(
			IPC_CHANNELS.loadBlinkStats,
			snapshot,
		);
	});

	it("showCameraWindow enables camera only when it was off", () => {
		const preferences = new PreferencesService(createStore());
		preferences.set("cameraEnabled", false);
		const reminders = { ensureCameraActive: vi.fn(), stopCameraIfIdle: vi.fn() };
		const windows = {
			sendPreferences: vi.fn(),
			sendToMain: vi.fn(),
			showCamera: vi.fn((onClosed: () => void) => {
				onClosed();
			}),
		};
		const actions = createActions(preferences, { reminders, windows });

		actions.showCameraWindow();

		expect(preferences.current.cameraEnabled).toBe(true);
		expect(reminders.ensureCameraActive).toHaveBeenCalledOnce();
		expect(windows.sendPreferences).toHaveBeenCalledOnce();
		expect(windows.showCamera).toHaveBeenCalledOnce();
		expect(windows.sendToMain).toHaveBeenCalledWith(
			IPC_CHANNELS.cameraWindowClosed,
		);
		expect(reminders.stopCameraIfIdle).toHaveBeenCalledOnce();
	});

	it("showCameraWindow still releases idle camera when it was already enabled", () => {
		const preferences = new PreferencesService(createStore());
		preferences.set("cameraEnabled", true);
		preferences.set("isTracking", false);
		const reminders = { ensureCameraActive: vi.fn(), stopCameraIfIdle: vi.fn() };
		const windows = {
			sendPreferences: vi.fn(),
			sendToMain: vi.fn(),
			showCamera: vi.fn((onClosed: () => void) => {
				onClosed();
			}),
		};
		const actions = createActions(preferences, { reminders, windows });

		actions.showCameraWindow();

		expect(reminders.ensureCameraActive).toHaveBeenCalledOnce();
		expect(windows.sendPreferences).not.toHaveBeenCalled();
		expect(reminders.stopCameraIfIdle).toHaveBeenCalledOnce();
	});

	it("applyBackup replaces prefs with side effects and optional stats", () => {
		const preferences = new PreferencesService(createStore());
		preferences.set("isTracking", true);
		const reminders = { stop: vi.fn() };
		const exercises = { stop: vi.fn() };
		const lookAway = { stop: vi.fn() };
		const focusPause = { recompute: vi.fn() };
		const snapshot = { totals: { total: 40 } };
		const blinkStats = {
			invalidateCharts: vi.fn(),
			isLivePushEnabled: () => true,
			getSnapshot: vi.fn(() => snapshot),
			replaceState: vi.fn(),
		};
		const windows = {
			sendPreferences: vi.fn(),
			sendToMain: vi.fn(),
			showCamera: vi.fn(),
		};
		const sidecar = {
			startEarCalibration: vi.fn(),
			cancelEarCalibration: vi.fn(),
			applyCameraQuality: vi.fn(),
			applyEarCalibration: vi.fn(),
			applyClassifierCalibration: vi.fn(),
		};
		const shortcuts = { registerAll: vi.fn() };
		const applyLaunchAtLogin = vi.fn();
		const tray = { rebuildMenu: vi.fn() };
		const actions = createActions(preferences, {
			reminders,
			exercises,
			lookAway,
			focusPause,
			blinkStats,
			windows,
			sidecar,
			shortcuts,
			applyLaunchAtLogin,
			tray,
		});

		actions.applyBackup("both", {
			preferences: {
				...preferences.current,
				locale: "uk",
				darkMode: false,
				launchAtLogin: true,
				keyboardShortcuts: {
					...preferences.current.keyboardShortcuts,
					trackingToggle: "Ctrl+B",
				},
				cameraQuality: "high",
				earCalibration: 0.25,
				classifierBias: 0.4,
				classifierThreshold: 0.2,
				isTracking: true,
			},
			blinkStats: {
				days: [],
				totalBlinks: 40,
				spentBlinks: 0,
				unlockedRewardIds: [],
				streakShieldCharges: 0,
				streakShieldUsedDates: [],
				rewardPurchaseCounts: {},
				shopDiscountLevel: 0,
			},
		});

		expect(reminders.stop).toHaveBeenCalledWith(true);
		expect(exercises.stop).toHaveBeenCalledOnce();
		expect(lookAway.stop).toHaveBeenCalledOnce();
		expect(sidecar.cancelEarCalibration).toHaveBeenCalledOnce();
		expect(preferences.current.locale).toBe("uk");
		expect(preferences.current.darkMode).toBe(false);
		expect(preferences.current.isTracking).toBe(false);
		expect(applyLaunchAtLogin).toHaveBeenCalledWith(true);
		expect(shortcuts.registerAll).toHaveBeenCalledWith({
			...preferences.current.keyboardShortcuts,
			trackingToggle: "Ctrl+B",
		});
		expect(sidecar.applyCameraQuality).toHaveBeenCalledWith("high");
		expect(sidecar.applyEarCalibration).toHaveBeenCalledWith(0.25);
		expect(sidecar.applyClassifierCalibration).toHaveBeenCalledWith({
			bias: 0.4,
			threshold: 0.2,
		});
		expect(tray.rebuildMenu).toHaveBeenCalledWith("uk");
		expect(blinkStats.invalidateCharts).toHaveBeenCalledOnce();
		expect(windows.sendPreferences).toHaveBeenCalledOnce();
		expect(focusPause.recompute).toHaveBeenCalledOnce();
		expect(blinkStats.replaceState).toHaveBeenCalledOnce();
		expect(windows.sendToMain).toHaveBeenCalledWith(
			IPC_CHANNELS.loadBlinkStats,
			snapshot,
		);
	});
});
