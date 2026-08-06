import { describe, expect, it } from "vitest";
import { PreferencesService } from "../../../electron/application/preferences-service";
import type { PreferenceStore } from "../../../electron/application/ports/preference-store";
import {
	DEFAULT_PREFERENCES,
	type PersistedPreferences,
} from "../../../shared/preferences";

class FakePreferenceStore implements PreferenceStore {
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

describe("PreferencesService", () => {
	it("loads defaults when the store is empty", () => {
		const service = new PreferencesService(new FakePreferenceStore());

		expect(service.current.reminderInterval).toBe(
			DEFAULT_PREFERENCES.reminderInterval,
		);
		expect(service.current.isTracking).toBe(false);
		expect(service.current.darkMode).toBe(DEFAULT_PREFERENCES.darkMode);
		expect(service.current.cameraQuality).toBe(
			DEFAULT_PREFERENCES.cameraQuality,
		);
	});

	it("hydrates persisted values from the store", () => {
		const store = new FakePreferenceStore();
		store.set("reminderInterval", 5000);
		store.set("darkMode", false);
		store.set("cameraQuality", "high");
		store.set("earCalibration", 0.31);
		store.set("useMediaPipe", true);

		const service = new PreferencesService(store);

		expect(service.current.reminderInterval).toBe(5000);
		expect(service.current.darkMode).toBe(false);
		expect(service.current.cameraQuality).toBe("high");
		expect(service.current.earCalibration).toBe(0.31);
		expect(service.current.useMediaPipe).toBe(true);
		expect(service.current.popupMessage).toBe(DEFAULT_PREFERENCES.popupMessage);
	});

	it("falls back to medium when cameraQuality in the store is invalid", () => {
		const store = new FakePreferenceStore();
		store.set("cameraQuality", "ultra");

		const service = new PreferencesService(store);

		expect(service.current.cameraQuality).toBe("medium");
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
		service.set("useMediaPipe", true);

		expect(service.current.keyboardShortcut).toBe("Ctrl+B");
		expect(store.get("keyboardShortcut")).toBe("Ctrl+B");
		expect(service.current.cameraQuality).toBe("performance");
		expect(store.get("cameraQuality")).toBe("performance");
		expect(service.current.earCalibration).toBe(0.28);
		expect(store.get("earCalibration")).toBe(0.28);
		expect(service.current.useMediaPipe).toBe(true);
	});

	it("reset clears the store and restores defaults with a popup position", () => {
		const store = new FakePreferenceStore();
		store.set("reminderInterval", 9000);
		store.set("soundEnabled", true);
		store.set("cameraQuality", "high");
		store.set("earCalibration", 0.33);
		store.set("useMediaPipe", true);
		const service = new PreferencesService(store);
		service.current.isTracking = true;

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
		expect(service.current.soundEnabled).toBe(DEFAULT_PREFERENCES.soundEnabled);
		expect(service.current.cameraQuality).toBe(
			DEFAULT_PREFERENCES.cameraQuality,
		);
		expect(service.current.earCalibration).toBeNull();
		expect(service.current.useMediaPipe).toBe(false);
	});
});
