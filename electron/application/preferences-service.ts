import {
	DEFAULT_PREFERENCES,
	sanitizeAutoStopNoFaceMinutes,
	sanitizeBlinkRateThresholdPerMin,
	sanitizeExercisePrompts,
	sanitizeSoundVolume,
	type AppPreferences,
	type PersistedPreferences,
} from "../../shared/preferences";
import { sanitizeLocale } from "../../shared/i18n";
import { isValidEarCalibration } from "../../shared/ear-calibration";
import { isCameraQuality } from "../../shared/camera-quality";
import {
	isValidQuietHoursTime,
	normalizeQuietHoursTime,
} from "../domain/focus-policy";
import type { PreferenceStore } from "./ports/preference-store";

const PERSISTED_KEYS = Object.keys(
	DEFAULT_PREFERENCES,
) as (keyof PersistedPreferences)[];

function samePreferenceValue(
	key: keyof PersistedPreferences,
	previous: PersistedPreferences[keyof PersistedPreferences],
	next: PersistedPreferences[keyof PersistedPreferences],
): boolean {
	if (previous === next) return true;
	if (key === "exercisePrompts") {
		const a = previous as string[];
		const b = next as string[];
		return (
			Array.isArray(a) &&
			Array.isArray(b) &&
			a.length === b.length &&
			a.every((value, index) => value === b[index])
		);
	}
	if (key === "popupColors") {
		const a = previous as PersistedPreferences["popupColors"];
		const b = next as PersistedPreferences["popupColors"];
		return (
			!!a &&
			!!b &&
			a.background === b.background &&
			a.text === b.text &&
			a.transparency === b.transparency
		);
	}
	if (key === "popupPosition") {
		const a = previous as PersistedPreferences["popupPosition"];
		const b = next as PersistedPreferences["popupPosition"];
		if (a === b) return true;
		if (!a || !b) return false;
		return a.x === b.x && a.y === b.y;
	}
	if (key === "popupSize") {
		const a = previous as PersistedPreferences["popupSize"];
		const b = next as PersistedPreferences["popupSize"];
		return !!a && !!b && a.width === b.width && a.height === b.height;
	}
	return false;
}

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
		if (typeof persisted.launchAtLogin !== "boolean") {
			persisted.launchAtLogin = DEFAULT_PREFERENCES.launchAtLogin;
		}
		if (typeof persisted.isTracking !== "boolean") {
			persisted.isTracking = DEFAULT_PREFERENCES.isTracking;
		}
		if (typeof persisted.quietHoursEnabled !== "boolean") {
			persisted.quietHoursEnabled = DEFAULT_PREFERENCES.quietHoursEnabled;
		}
		if (!isValidQuietHoursTime(persisted.quietHoursStart)) {
			persisted.quietHoursStart = DEFAULT_PREFERENCES.quietHoursStart;
		} else {
			persisted.quietHoursStart =
				normalizeQuietHoursTime(persisted.quietHoursStart) ??
				DEFAULT_PREFERENCES.quietHoursStart;
		}
		if (!isValidQuietHoursTime(persisted.quietHoursEnd)) {
			persisted.quietHoursEnd = DEFAULT_PREFERENCES.quietHoursEnd;
		} else {
			persisted.quietHoursEnd =
				normalizeQuietHoursTime(persisted.quietHoursEnd) ??
				DEFAULT_PREFERENCES.quietHoursEnd;
		}
		if (typeof persisted.pauseOnFullscreen !== "boolean") {
			persisted.pauseOnFullscreen = DEFAULT_PREFERENCES.pauseOnFullscreen;
		}
		if (typeof persisted.hasCompletedOnboarding !== "boolean") {
			persisted.hasCompletedOnboarding =
				DEFAULT_PREFERENCES.hasCompletedOnboarding;
		}
		if (typeof persisted.blinkRateCoachingEnabled !== "boolean") {
			persisted.blinkRateCoachingEnabled =
				DEFAULT_PREFERENCES.blinkRateCoachingEnabled;
		}
		if (typeof persisted.autoStopNoFaceEnabled !== "boolean") {
			persisted.autoStopNoFaceEnabled =
				DEFAULT_PREFERENCES.autoStopNoFaceEnabled;
		}
		persisted.locale = sanitizeLocale(persisted.locale);
		persisted.blinkRateThresholdPerMin = sanitizeBlinkRateThresholdPerMin(
			persisted.blinkRateThresholdPerMin,
		);
		persisted.autoStopNoFaceMinutes = sanitizeAutoStopNoFaceMinutes(
			persisted.autoStopNoFaceMinutes,
		);
		persisted.soundVolume = sanitizeSoundVolume(persisted.soundVolume);
		persisted.exercisePrompts = sanitizeExercisePrompts(
			persisted.exercisePrompts,
			persisted.locale,
		);

		// Upgrade: existing installs without the flag should skip first-run.
		if (!this.store.has("hasCompletedOnboarding")) {
			const looksLikeExistingUser = PERSISTED_KEYS.some(
				(key) =>
					key !== "hasCompletedOnboarding" && this.store.has(key),
			);
			if (looksLikeExistingUser) {
				persisted.hasCompletedOnboarding = true;
				this.store.set("hasCompletedOnboarding", true);
			}
		}

		this.current = { ...persisted };
	}

	set<K extends keyof PersistedPreferences>(
		key: K,
		value: PersistedPreferences[K],
	): void {
		let next = value;
		if (key === "locale") {
			next = sanitizeLocale(value) as PersistedPreferences[K];
		} else if (key === "exercisePrompts") {
			next = sanitizeExercisePrompts(
				value,
				this.current.locale,
			) as PersistedPreferences[K];
		} else if (key === "blinkRateThresholdPerMin") {
			next = sanitizeBlinkRateThresholdPerMin(
				value,
			) as PersistedPreferences[K];
		} else if (key === "autoStopNoFaceMinutes") {
			next = sanitizeAutoStopNoFaceMinutes(
				value,
			) as PersistedPreferences[K];
		} else if (key === "soundVolume") {
			next = sanitizeSoundVolume(value) as PersistedPreferences[K];
		}
		// No-op equal writes: settings sync and dual IPC callers re-send often.
		if (samePreferenceValue(key, this.current[key], next)) {
			return;
		}
		this.current[key] = next as never;
		this.store.set(key, next);
	}

	reset(
		popupPosition: PersistedPreferences["popupPosition"],
		options?: { replayOnboarding?: boolean },
	): void {
		this.store.clear();
		Object.assign(this.current, DEFAULT_PREFERENCES, {
			popupPosition,
		});
		if (!options?.replayOnboarding) {
			this.set("hasCompletedOnboarding", true);
		}
	}
}
