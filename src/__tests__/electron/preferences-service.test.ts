import { describe, expect, it } from "vitest";
import type { PreferenceStore } from "../../../electron/application/ports/preference-store";
import { PreferencesService } from "../../../electron/application/preferences-service";
import {
	DEFAULT_PREFERENCES,
	type PersistedPreferences,
} from "../../../shared/preferences";

class FakePreferenceStore implements PreferenceStore {
	private readonly data = new Map<string, unknown>();
	readonly setCounts = new Map<string, number>();

	get<T>(key: string, defaultValue?: T): T {
		if (this.data.has(key)) return this.data.get(key) as T;
		return defaultValue as T;
	}

	set<T>(key: string, value: T): void {
		this.data.set(key, value);
		this.setCounts.set(key, (this.setCounts.get(key) ?? 0) + 1);
	}

	has(key: string): boolean {
		return this.data.has(key);
	}

	clear(): void {
		this.data.clear();
	}
}

describe("PreferencesService", () => {
	it("loads defaults when the store is empty", () => {
		const service = new PreferencesService(new FakePreferenceStore());

		expect(service.current.reminderInterval).toBe(
			DEFAULT_PREFERENCES.reminderInterval,
		);
		expect(service.current.isTracking).toBe(false);
		expect(service.current.launchAtLogin).toBe(false);
		expect(service.current.hasCompletedOnboarding).toBe(false);
		expect(service.current.darkMode).toBe(DEFAULT_PREFERENCES.darkMode);
		expect(service.current.cameraQuality).toBe(
			DEFAULT_PREFERENCES.cameraQuality,
		);
		expect(service.current.autoStopNoFaceEnabled).toBe(true);
		expect(service.current.autoStopNoFaceMinutes).toBe(2);
	});

	it("migrates upgrades to hasCompletedOnboarding when other prefs exist", () => {
		const store = new FakePreferenceStore();
		store.set("keyboardShortcut", "Ctrl+B");

		const service = new PreferencesService(store);

		expect(service.current.hasCompletedOnboarding).toBe(true);
		expect(store.get("hasCompletedOnboarding")).toBe(true);
	});

	it("keeps first-run onboarding when the store is empty", () => {
		const store = new FakePreferenceStore();
		const service = new PreferencesService(store);

		expect(service.current.hasCompletedOnboarding).toBe(false);
		expect(store.has("hasCompletedOnboarding")).toBe(false);
	});

	it("respects an explicit hasCompletedOnboarding false on upgrade-shaped stores", () => {
		const store = new FakePreferenceStore();
		store.set("keyboardShortcut", "Ctrl+B");
		store.set("hasCompletedOnboarding", false);

		const service = new PreferencesService(store);

		expect(service.current.hasCompletedOnboarding).toBe(false);
	});

	it("hydrates persisted values from the store", () => {
		const store = new FakePreferenceStore();
		store.set("reminderInterval", 5000);
		store.set("darkMode", false);
		store.set("cameraQuality", "high");
		store.set("earCalibration", 0.31);
		store.set("launchAtLogin", true);
		store.set("isTracking", true);

		const service = new PreferencesService(store);

		expect(service.current.reminderInterval).toBe(5000);
		expect(service.current.darkMode).toBe(false);
		expect(service.current.cameraQuality).toBe("high");
		expect(service.current.earCalibration).toBe(0.31);
		expect(service.current.launchAtLogin).toBe(true);
		expect(service.current.isTracking).toBe(true);
		expect(service.current.popupMessage).toBe(DEFAULT_PREFERENCES.popupMessage);
	});

	it("falls back to medium when cameraQuality in the store is invalid", () => {
		const store = new FakePreferenceStore();
		store.set("cameraQuality", "turbo");

		const service = new PreferencesService(store);

		expect(service.current.cameraQuality).toBe("medium");
	});

	it("sanitizes invalid locale to en", () => {
		const store = new FakePreferenceStore();
		store.set("locale", "de");

		const service = new PreferencesService(store);

		expect(service.current.locale).toBe("en");
	});

	it("persists a valid locale", () => {
		const store = new FakePreferenceStore();
		store.set("locale", "uk");

		const service = new PreferencesService(store);

		expect(service.current.locale).toBe("uk");
		service.set("locale", "en");
		expect(service.current.locale).toBe("en");
	});

	it("sanitizes empty or invalid exercisePrompts on load", () => {
		const store = new FakePreferenceStore();
		store.set("exercisePrompts", []);

		const service = new PreferencesService(store);

		expect(service.current.exercisePrompts).toEqual(
			DEFAULT_PREFERENCES.exercisePrompts,
		);
		expect(service.current.exercisePrompts).toHaveLength(4);
	});

	it("sanitizes exercisePrompts on set()", () => {
		const store = new FakePreferenceStore();
		const service = new PreferencesService(store);

		service.set("exercisePrompts", ["  Custom stretch  ", ""]);

		expect(service.current.exercisePrompts).toEqual(["Custom stretch"]);
		expect(store.get("exercisePrompts")).toEqual(["Custom stretch"]);

		service.set("exercisePrompts", []);
		expect(service.current.exercisePrompts).toEqual(
			DEFAULT_PREFERENCES.exercisePrompts,
		);
	});

	it("sanitizes blinkRateThresholdPerMin on load and set()", () => {
		const store = new FakePreferenceStore();
		store.set("blinkRateThresholdPerMin", 100);
		store.set("blinkRateCoachingEnabled", "yes");

		const service = new PreferencesService(store);

		expect(service.current.blinkRateThresholdPerMin).toBe(60);
		expect(service.current.blinkRateCoachingEnabled).toBe(true);

		service.set("blinkRateThresholdPerMin", 0);
		expect(service.current.blinkRateThresholdPerMin).toBe(1);
		expect(store.get("blinkRateThresholdPerMin")).toBe(1);

		service.set("blinkRateCoachingEnabled", false);
		expect(service.current.blinkRateCoachingEnabled).toBe(false);
	});

	it("clears invalid earCalibration from the store", () => {
		const store = new FakePreferenceStore();
		store.set("earCalibration", 9.9);

		const service = new PreferencesService(store);

		expect(service.current.earCalibration).toBeNull();
	});

	it("persists set() into both memory and the store", () => {
		const store = new FakePreferenceStore();
		const service = new PreferencesService(store);

		service.set("keyboardShortcut", "Ctrl+B");
		service.set("cameraQuality", "performance");
		service.set("earCalibration", 0.28);
		service.set("launchAtLogin", true);
		service.set("isTracking", true);

		expect(service.current.keyboardShortcut).toBe("Ctrl+B");
		expect(store.get("keyboardShortcut")).toBe("Ctrl+B");
		expect(service.current.cameraQuality).toBe("performance");
		expect(store.get("cameraQuality")).toBe("performance");
		expect(service.current.earCalibration).toBe(0.28);
		expect(store.get("earCalibration")).toBe(0.28);
		expect(service.current.launchAtLogin).toBe(true);
		expect(store.get("launchAtLogin")).toBe(true);
		expect(service.current.isTracking).toBe(true);
		expect(store.get("isTracking")).toBe(true);
	});

	it("no-ops set() when the sanitized value is unchanged", () => {
		const store = new FakePreferenceStore();
		const service = new PreferencesService(store);

		service.set("darkMode", DEFAULT_PREFERENCES.darkMode);
		expect(store.setCounts.get("darkMode") ?? 0).toBe(0);

		service.set("darkMode", !DEFAULT_PREFERENCES.darkMode);
		expect(store.setCounts.get("darkMode")).toBe(1);
		service.set("darkMode", !DEFAULT_PREFERENCES.darkMode);
		expect(store.setCounts.get("darkMode")).toBe(1);

		service.set("exercisePrompts", [...service.current.exercisePrompts]);
		expect(store.setCounts.get("exercisePrompts") ?? 0).toBe(0);

		service.set("autoStopNoFaceMinutes", 2);
		expect(store.setCounts.get("autoStopNoFaceMinutes") ?? 0).toBe(0);
		service.set("autoStopNoFaceMinutes", 99);
		expect(service.current.autoStopNoFaceMinutes).toBe(30);
		expect(store.setCounts.get("autoStopNoFaceMinutes")).toBe(1);

		service.set("soundVolume", 100);
		expect(store.setCounts.get("soundVolume") ?? 0).toBe(0);
		service.set("soundVolume", 50);
		expect(service.current.soundVolume).toBe(50);
		expect(store.setCounts.get("soundVolume")).toBe(1);
		service.set("soundVolume", 150);
		expect(service.current.soundVolume).toBe(100);
		expect(store.setCounts.get("soundVolume")).toBe(2);
	});

	it("sanitizes invalid autoStopNoFaceMinutes on hydrate", () => {
		const store = new FakePreferenceStore();
		store.set("autoStopNoFaceMinutes", 0);
		store.set("autoStopNoFaceEnabled", "yes");

		const service = new PreferencesService(store);

		expect(service.current.autoStopNoFaceMinutes).toBe(1);
		expect(service.current.autoStopNoFaceEnabled).toBe(true);
	});

	it("sanitizes invalid soundVolume on hydrate", () => {
		const store = new FakePreferenceStore();
		store.set("soundVolume", -20);

		const service = new PreferencesService(store);

		expect(service.current.soundVolume).toBe(0);
	});

	it("reset clears the store and restores defaults with a popup position", () => {
		const store = new FakePreferenceStore();
		store.set("reminderInterval", 9000);
		store.set("soundEnabled", true);
		store.set("cameraQuality", "high");
		store.set("earCalibration", 0.33);
		store.set("launchAtLogin", true);
		store.set("isTracking", true);
		const service = new PreferencesService(store);

		const popupPosition: PersistedPreferences["popupPosition"] = {
			x: 40,
			y: 80,
		};
		service.reset(popupPosition);

		expect(store.has("reminderInterval")).toBe(false);
		expect(service.current.reminderInterval).toBe(
			DEFAULT_PREFERENCES.reminderInterval,
		);
		expect(service.current.popupPosition).toEqual(popupPosition);
		expect(service.current.isTracking).toBe(false);
		expect(service.current.launchAtLogin).toBe(false);
		expect(service.current.hasCompletedOnboarding).toBe(true);
		expect(store.get("hasCompletedOnboarding")).toBe(true);
		expect(service.current.soundEnabled).toBe(DEFAULT_PREFERENCES.soundEnabled);
		expect(service.current.soundVolume).toBe(DEFAULT_PREFERENCES.soundVolume);
		expect(service.current.cameraQuality).toBe(
			DEFAULT_PREFERENCES.cameraQuality,
		);
		expect(service.current.earCalibration).toBeNull();
	});

	it("reset can clear popupPosition so defaults follow the active display", () => {
		const store = new FakePreferenceStore();
		store.set("popupPosition", { x: 40, y: 80 });
		const service = new PreferencesService(store);

		service.reset(null);

		expect(service.current.popupPosition).toBeNull();
	});

	it("reset with replayOnboarding leaves first-run incomplete", () => {
		const store = new FakePreferenceStore();
		store.set("hasCompletedOnboarding", true);
		const service = new PreferencesService(store);

		service.reset(null, { replayOnboarding: true });

		expect(service.current.hasCompletedOnboarding).toBe(false);
		expect(store.has("hasCompletedOnboarding")).toBe(false);
	});

	it("replaceFromBackup restores key prefs and forces isTracking false", () => {
		const store = new FakePreferenceStore();
		store.set("darkMode", true);
		store.set("locale", "en");
		const service = new PreferencesService(store);

		service.replaceFromBackup({
			...DEFAULT_PREFERENCES,
			darkMode: false,
			locale: "uk",
			reminderInterval: 7000,
			keyboardShortcut: "Ctrl+B",
			isTracking: true,
			hasCompletedOnboarding: true,
			cameraQuality: "high",
			dailyBlinkGoal: 100,
		});

		expect(service.current.darkMode).toBe(false);
		expect(service.current.locale).toBe("uk");
		expect(service.current.reminderInterval).toBe(7000);
		expect(service.current.keyboardShortcut).toBe("Ctrl+B");
		expect(service.current.isTracking).toBe(false);
		expect(service.current.hasCompletedOnboarding).toBe(true);
		expect(service.current.cameraQuality).toBe("high");
		expect(service.current.dailyBlinkGoal).toBe(100);
		expect(store.get("isTracking")).toBe(false);
		expect(store.get("locale")).toBe("uk");
	});

	it("replaceFromBackup clamps invalid fields instead of rejecting", () => {
		const store = new FakePreferenceStore();
		const service = new PreferencesService(store);

		service.replaceFromBackup({
			...DEFAULT_PREFERENCES,
			autoStopNoFaceMinutes: 99,
			soundVolume: -5,
			cameraQuality: "ultra" as never,
		});

		expect(service.current.autoStopNoFaceMinutes).toBe(30);
		expect(service.current.soundVolume).toBe(0);
		expect(service.current.cameraQuality).toBe(
			DEFAULT_PREFERENCES.cameraQuality,
		);
	});
});
