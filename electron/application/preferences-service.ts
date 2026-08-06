import { isValidEarCalibration } from "../../shared/ear-calibration";
import { isCameraQuality } from "../../shared/camera-quality";
import {
	DEFAULT_PREFERENCES,
	type AppPreferences,
	type PersistedPreferences,
} from "../../shared/preferences";
import type { PreferenceStore } from "./ports/preference-store";

const PERSISTED_KEYS = Object.keys(
	DEFAULT_PREFERENCES,
) as (keyof PersistedPreferences)[];

export class PreferencesService {
	readonly current: AppPreferences;

	constructor(private readonly store: PreferenceStore) {
		const persisted = { ...DEFAULT_PREFERENCES } as PersistedPreferences;
		for (const key of PERSISTED_KEYS) {
			persisted[key] = this.store.get(key, DEFAULT_PREFERENCES[key]) as never;
		}
		if (!isCameraQuality(persisted.cameraQuality)) {
			persisted.cameraQuality = DEFAULT_PREFERENCES.cameraQuality;
		}
		if (
			persisted.earCalibration !== null &&
			!isValidEarCalibration(persisted.earCalibration)
		) {
			persisted.earCalibration = DEFAULT_PREFERENCES.earCalibration;
		}
		if (typeof persisted.useMediaPipe !== "boolean") {
			persisted.useMediaPipe = DEFAULT_PREFERENCES.useMediaPipe;
		}
		if (typeof persisted.launchAtLogin !== "boolean") {
			persisted.launchAtLogin = DEFAULT_PREFERENCES.launchAtLogin;
		}
		if (typeof persisted.isTracking !== "boolean") {
			persisted.isTracking = DEFAULT_PREFERENCES.isTracking;
		}

		this.current = { ...persisted };
	}

	set<K extends keyof PersistedPreferences>(
		key: K,
		value: PersistedPreferences[K],
	): void {
		this.current[key] = value as never;
		this.store.set(key, value);
	}

	reset(popupPosition: PersistedPreferences["popupPosition"]): void {
		this.store.clear();
		Object.assign(this.current, DEFAULT_PREFERENCES, {
			popupPosition,
		});
	}
}
