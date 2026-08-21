import { sameCameraDevice } from "./camera-devices";
import {
	DEFAULT_PREFERENCES,
	samePauseAppRules,
	sameQuietHoursByWeekday,
	sanitizePersistedPreferences,
	type PersistedPreferences,
	type QuietHoursByWeekday,
} from "./preferences";

/** Cap enforced in sanitize + save. */
export const SETTINGS_PROFILE_CAP = 5;

/** Single electron-store key for the settings-profiles envelope. */
export const SETTINGS_PROFILES_STORE_KEY = "settingsProfiles";

/**
 * Allowlist (Q6 + Q1 + `blinkPromptProfile`). Write only these keys on apply.
 * `isTracking` is intentionally absent (Q5 keep-running).
 */
export const SNAPSHOT_KEYS = [
	"cameraEnabled",
	"cameraQuality",
	"cameraDevice",
	"blinkRateCoachingEnabled",
	"blinkRateThresholdPerMin",
	"mgdMode",
	"blinkPopupClickThrough",
	"reminderInterval",
	"microBreakInterval",
	"blinkPromptProfile",
	"eyeExercisesEnabled",
	"exerciseInterval",
	"lookAwayEnabled",
	"lookAwayInterval",
	"lookAwayDuration",
	"quietHoursEnabled",
	"quietHoursStart",
	"quietHoursEnd",
	"quietHoursByWeekday",
	"pauseOnFullscreen",
	"pauseAppRules",
	"notificationStyle",
	"snoozeMinutes",
	"soundEnabled",
	"soundVolume",
	"earCalibration",
	"classifierBias",
	"classifierThreshold",
	"calibrationAt",
	"calibrationNudgeEnabled",
	"calibrationNudgeDismissedAt",
	"lastBaselineDriftAt",
] as const satisfies readonly (keyof PersistedPreferences)[];

export type SettingsProfilePrefs = Pick<
	PersistedPreferences,
	(typeof SNAPSHOT_KEYS)[number]
>;

export interface SettingsProfile {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	prefs: SettingsProfilePrefs;
}

export interface SettingsProfilesState {
	version: 1;
	/** Last saved/switched id; null if none. Dirty does not null this. */
	activeProfileId: string | null;
	profiles: SettingsProfile[];
}

export type SettingsProfileSummary = {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
};

export type SettingsProfilesOk = {
	ok: true;
	profiles: SettingsProfileSummary[];
	activeProfileId: string | null;
	dirty: boolean;
};

export type SettingsProfilesErr = {
	ok: false;
	code: "not-found" | "cap" | "invalid-name" | "dirty" | "error";
	message?: string;
};

export type SettingsProfilesResult = SettingsProfilesOk | SettingsProfilesErr;

export const EMPTY_SETTINGS_PROFILES_STATE: SettingsProfilesState = {
	version: 1,
	activeProfileId: null,
	profiles: [],
};

const SETTINGS_PROFILE_NAME_MAX = 40;

function pickSnapshotPrefs(full: PersistedPreferences): SettingsProfilePrefs {
	const out = {} as SettingsProfilePrefs;
	for (const key of SNAPSHOT_KEYS) {
		(out as PersistedPreferences)[key] = full[key] as never;
	}
	return out;
}

/**
 * Trim, collapse internal whitespace, strip ASCII controls, max 40.
 * Empty after sanitize → null (invalid-name).
 */
export function sanitizeSettingsProfileName(raw: unknown): string | null {
	if (typeof raw !== "string") return null;
	const stripped = raw
		.replace(/[\u0000-\u001F\u007F]/g, "")
		.trim()
		.replace(/\s+/g, " ");
	if (!stripped) return null;
	return stripped.slice(0, SETTINGS_PROFILE_NAME_MAX);
}

export function captureSettingsProfilePrefs(
	live: PersistedPreferences,
): SettingsProfilePrefs {
	const sanitized = sanitizePersistedPreferences({
		...DEFAULT_PREFERENCES,
		...live,
	});
	return pickSnapshotPrefs(sanitized);
}

/**
 * Merge snapshot onto live, sanitize, and return a full prefs object.
 * Callers must write back **only** SNAPSHOT_KEYS so excluded keys stay as in live.
 */
export function overlaySettingsProfilePrefs(
	live: PersistedPreferences,
	snapshot: unknown,
): PersistedPreferences {
	const snapshotRecord =
		snapshot && typeof snapshot === "object"
			? (snapshot as Record<string, unknown>)
			: {};
	const picked: Record<string, unknown> = {};
	for (const key of SNAPSHOT_KEYS) {
		if (Object.prototype.hasOwnProperty.call(snapshotRecord, key)) {
			picked[key] = snapshotRecord[key];
		}
	}
	return sanitizePersistedPreferences({
		...live,
		...picked,
	});
}

function sameSnapshotValue(
	key: (typeof SNAPSHOT_KEYS)[number],
	a: PersistedPreferences[typeof key],
	b: PersistedPreferences[typeof key],
): boolean {
	if (a === b) return true;
	if (key === "cameraDevice") {
		return sameCameraDevice(
			a as PersistedPreferences["cameraDevice"],
			b as PersistedPreferences["cameraDevice"],
		);
	}
	if (key === "quietHoursByWeekday") {
		return sameQuietHoursByWeekday(
			a as QuietHoursByWeekday,
			b as QuietHoursByWeekday,
		);
	}
	if (key === "pauseAppRules") {
		return samePauseAppRules(
			a as PersistedPreferences["pauseAppRules"],
			b as PersistedPreferences["pauseAppRules"],
		);
	}
	return false;
}

export function sameSettingsProfilePrefs(
	a: SettingsProfilePrefs,
	b: SettingsProfilePrefs,
): boolean {
	for (const key of SNAPSHOT_KEYS) {
		if (!sameSnapshotValue(key, a[key], b[key])) return false;
	}
	return true;
}

function isIsoTimestamp(value: unknown): value is string {
	if (typeof value !== "string" || !value.trim()) return false;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed);
}

function sanitizeOneProfile(raw: unknown): SettingsProfile | null {
	if (!raw || typeof raw !== "object") return null;
	const record = raw as Record<string, unknown>;
	const id = typeof record.id === "string" ? record.id.trim() : "";
	if (!id) return null;
	const name = sanitizeSettingsProfileName(record.name);
	if (!name) return null;
	const createdAt = isIsoTimestamp(record.createdAt)
		? record.createdAt
		: new Date(0).toISOString();
	const updatedAt = isIsoTimestamp(record.updatedAt)
		? record.updatedAt
		: createdAt;
	const prefs = captureSettingsProfilePrefs(
		sanitizePersistedPreferences(record.prefs),
	);
	return { id, name, createdAt, updatedAt, prefs };
}

/**
 * Sanitize on every read. Corrupt/partial → empty state or drop bad records.
 * Never throws.
 */
export function sanitizeSettingsProfilesState(
	raw: unknown,
): SettingsProfilesState {
	try {
		if (!raw || typeof raw !== "object") {
			return { ...EMPTY_SETTINGS_PROFILES_STATE };
		}
		const record = raw as Record<string, unknown>;
		const profilesRaw = Array.isArray(record.profiles) ? record.profiles : [];
		const profiles: SettingsProfile[] = [];
		const seenIds = new Set<string>();
		for (const item of profilesRaw) {
			const profile = sanitizeOneProfile(item);
			if (!profile) continue;
			if (seenIds.has(profile.id)) continue;
			seenIds.add(profile.id);
			profiles.push(profile);
			if (profiles.length >= SETTINGS_PROFILE_CAP) break;
		}
		const activeRaw = record.activeProfileId;
		const activeProfileId =
			typeof activeRaw === "string" &&
			activeRaw &&
			profiles.some((p) => p.id === activeRaw)
				? activeRaw
				: null;
		return {
			version: 1,
			activeProfileId,
			profiles,
		};
	} catch {
		return { ...EMPTY_SETTINGS_PROFILES_STATE };
	}
}

export function toSettingsProfileSummary(
	profile: SettingsProfile,
): SettingsProfileSummary {
	return {
		id: profile.id,
		name: profile.name,
		createdAt: profile.createdAt,
		updatedAt: profile.updatedAt,
	};
}
