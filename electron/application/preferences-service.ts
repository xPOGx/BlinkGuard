import {
	DEFAULT_PREFERENCES,
	sanitizeAutoStopNoFaceMinutes,
	sanitizeBlinkRateThresholdPerMin,
	sanitizeExercisePrompts,
	sanitizeLookAwayHint,
	sanitizeLookAwayTitle,
	sanitizePersistedPreferences,
	sanitizeSoundVolume,
	type AppPreferences,
	type PersistedPreferences,
} from "../../shared/preferences";
import { sanitizeLocale } from "../../shared/i18n";
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
		const loaded = { ...DEFAULT_PREFERENCES } as PersistedPreferences;
		for (const key of PERSISTED_KEYS) {
			loaded[key] = this.store.get(key, DEFAULT_PREFERENCES[key]) as never;
		}
		const persisted = sanitizePersistedPreferences(loaded);

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
		} else if (key === "lookAwayTitle") {
			next = sanitizeLookAwayTitle(
				value,
				this.current.locale,
			) as PersistedPreferences[K];
		} else if (key === "lookAwayHint") {
			next = sanitizeLookAwayHint(
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

	/**
	 * Replace all persisted preferences from a sanitized backup payload.
	 * Caller should pass output of sanitizePersistedPreferences (with forceIsTrackingFalse).
	 */
	replaceFromBackup(preferences: PersistedPreferences): void {
		const next = sanitizePersistedPreferences(preferences, {
			forceIsTrackingFalse: true,
		});
		this.store.clear();
		Object.assign(this.current, next);
		for (const key of PERSISTED_KEYS) {
			this.store.set(key, this.current[key]);
		}
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
