import { BLINK_RATE_LOW_MAX } from "./blink-rate";
import { isValidEarCalibration } from "./ear-calibration";
import {
	defaultExercisePrompts,
	defaultLookAwayHint,
	defaultLookAwayTitle,
	defaultPopupMessage,
	sanitizeLocale,
	type Locale,
} from "./i18n";

export type { Locale };

export interface Point {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface PopupColors {
	background: string;
	text: string;
	transparency: number;
}

export type CameraQuality = "performance" | "medium" | "high";

const BLINK_RATE_THRESHOLD_MIN = 1;
const BLINK_RATE_THRESHOLD_MAX = 60;

const AUTO_STOP_NO_FACE_MINUTES_MIN = 1;
const AUTO_STOP_NO_FACE_MINUTES_MAX = 30;
const AUTO_STOP_NO_FACE_MINUTES_DEFAULT = 2;

const SOUND_VOLUME_MIN = 0;
const SOUND_VOLUME_MAX = 100;
const SOUND_VOLUME_DEFAULT = 100;

/** Headroom for ambitious weekly blink targets (workday-scale). */
const GOAL_BLINKS_MAX = 100_000;
const GOAL_TRACKING_MINUTES_MAX = 24 * 7 * 60;

export type GoalsConfig = {
	goalsEnabled: boolean;
	dailyBlinkGoal: number;
	dailyTrackingMinutesGoal: number;
	weeklyBlinkGoal: number;
	weeklyTrackingMinutesGoal: number;
};

/**
 * Defaults aim at healthier screen-time habits with camera tracking:
 * ~12–15 blinks/min (better than typical CVS drop to ~5) over a workday,
 * plus several hours of monitoring Mon–Fri.
 */
export const DEFAULT_GOALS_CONFIG: Readonly<GoalsConfig> = {
	goalsEnabled: true,
	/** ~12.5 blinks/min × 6h focused screen time. */
	dailyBlinkGoal: 4500,
	/** Cover a typical core workday with tracking on. */
	dailyTrackingMinutesGoal: 300,
	/** ~4–5 solid workdays in a Mon–Sun week. */
	weeklyBlinkGoal: 20_000,
	/** ~5 × 5h monitored days. */
	weeklyTrackingMinutesGoal: 1500,
};

function sanitizeGoalBlinks(input: unknown, fallback: number): number {
	if (input === null || input === undefined || input === "") return fallback;
	const n = typeof input === "number" ? input : Number(input);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(GOAL_BLINKS_MAX, Math.max(0, Math.round(n)));
}

function sanitizeGoalMinutes(input: unknown, fallback: number): number {
	if (input === null || input === undefined || input === "") return fallback;
	const n = typeof input === "number" ? input : Number(input);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(GOAL_TRACKING_MINUTES_MAX, Math.max(0, Math.round(n)));
}

/** Coerce stored/IPC goals config; 0 disables that metric. */
export function sanitizeGoalsConfig(input: unknown): GoalsConfig {
	const defaults = DEFAULT_GOALS_CONFIG;
	if (!input || typeof input !== "object") {
		return { ...defaults };
	}
	const record = input as Record<string, unknown>;
	return {
		goalsEnabled:
			typeof record.goalsEnabled === "boolean"
				? record.goalsEnabled
				: defaults.goalsEnabled,
		dailyBlinkGoal: sanitizeGoalBlinks(
			record.dailyBlinkGoal,
			defaults.dailyBlinkGoal,
		),
		dailyTrackingMinutesGoal: sanitizeGoalMinutes(
			record.dailyTrackingMinutesGoal,
			defaults.dailyTrackingMinutesGoal,
		),
		weeklyBlinkGoal: sanitizeGoalBlinks(
			record.weeklyBlinkGoal,
			defaults.weeklyBlinkGoal,
		),
		weeklyTrackingMinutesGoal: sanitizeGoalMinutes(
			record.weeklyTrackingMinutesGoal,
			defaults.weeklyTrackingMinutesGoal,
		),
	};
}

export function goalsConfigFromPreferences(
	preferences: Pick<
		PersistedPreferences,
		| "goalsEnabled"
		| "dailyBlinkGoal"
		| "dailyTrackingMinutesGoal"
		| "weeklyBlinkGoal"
		| "weeklyTrackingMinutesGoal"
	>,
): GoalsConfig {
	return {
		goalsEnabled: preferences.goalsEnabled,
		dailyBlinkGoal: preferences.dailyBlinkGoal,
		dailyTrackingMinutesGoal: preferences.dailyTrackingMinutesGoal,
		weeklyBlinkGoal: preferences.weeklyBlinkGoal,
		weeklyTrackingMinutesGoal: preferences.weeklyTrackingMinutesGoal,
	};
}

/** Coerce stored/IPC blink-rate coaching threshold to 1…60. */
export function sanitizeBlinkRateThresholdPerMin(input: unknown): number {
	if (input === null || input === undefined || input === "") {
		return BLINK_RATE_LOW_MAX;
	}
	const n = typeof input === "number" ? input : Number(input);
	if (!Number.isFinite(n)) return BLINK_RATE_LOW_MAX;
	return Math.min(
		BLINK_RATE_THRESHOLD_MAX,
		Math.max(BLINK_RATE_THRESHOLD_MIN, Math.round(n)),
	);
}

/** Coerce stored/IPC auto-stop-on-no-face minutes to 1…30. */
export function sanitizeAutoStopNoFaceMinutes(input: unknown): number {
	if (input === null || input === undefined || input === "") {
		return AUTO_STOP_NO_FACE_MINUTES_DEFAULT;
	}
	const n = typeof input === "number" ? input : Number(input);
	if (!Number.isFinite(n)) return AUTO_STOP_NO_FACE_MINUTES_DEFAULT;
	return Math.min(
		AUTO_STOP_NO_FACE_MINUTES_MAX,
		Math.max(AUTO_STOP_NO_FACE_MINUTES_MIN, Math.round(n)),
	);
}

/** Coerce stored/IPC notification sound volume to 0…100. */
export function sanitizeSoundVolume(input: unknown): number {
	if (input === null || input === undefined || input === "") {
		return SOUND_VOLUME_DEFAULT;
	}
	const n = typeof input === "number" ? input : Number(input);
	if (!Number.isFinite(n)) return SOUND_VOLUME_DEFAULT;
	return Math.min(
		SOUND_VOLUME_MAX,
		Math.max(SOUND_VOLUME_MIN, Math.round(n)),
	);
}

export interface PersistedPreferences {
	darkMode: boolean;
	reminderInterval: number;
	cameraEnabled: boolean;
	cameraQuality: CameraQuality;
	/** Stop tracking after sustained no-face while camera monitoring. */
	autoStopNoFaceEnabled: boolean;
	/** Minutes without a face before auto-stop (1…30). */
	autoStopNoFaceMinutes: number;
	/** Soft toast when live camera blink rate is below threshold. */
	blinkRateCoachingEnabled: boolean;
	/** Soft-coach when blinks/min is strictly below this value (default = Low band). */
	blinkRateThresholdPerMin: number;
	/** Personal open-eye EAR baseline; null when unset. */
	earCalibration: number | null;
	eyeExercisesEnabled: boolean;
	exerciseInterval: number;
	/** Rotating eye-exercise instruction texts shown in the exercise popup. */
	exercisePrompts: string[];
	/** Periodic 20-20-20 style look-away breaks (independent of blink tracking). */
	lookAwayEnabled: boolean;
	/** Minutes between look-away prompts. */
	lookAwayInterval: number;
	/** Seconds to look away (countdown in popup). */
	lookAwayDuration: number;
	/** Look-away popup title (user-editable; built-ins localize). */
	lookAwayTitle: string;
	/** Look-away popup hint (user-editable; built-ins localize). */
	lookAwayHint: string;
	popupPosition: Point | null;
	popupSize: Size;
	popupColors: PopupColors;
	popupMessage: string;
	/** When true, blink popup ignores mouse (watermark); snooze via tray. */
	blinkPopupClickThrough: boolean;
	keyboardShortcut: string;
	mgdMode: boolean;
	soundEnabled: boolean;
	/** Notification sound loudness 0…100 (HTML audio volume = value / 100). */
	soundVolume: number;
	/** Opt-in: start BlinkGuard at OS login (hidden to tray). */
	launchAtLogin: boolean;
	/** Whether blink reminders are active; persisted across restarts. */
	isTracking: boolean;
	/** Suppress interruptive popups during a local-time window. */
	quietHoursEnabled: boolean;
	/** Quiet-hours start as local HH:mm (24h). */
	quietHoursStart: string;
	/** Quiet-hours end as local HH:mm (24h); may be earlier than start (overnight). */
	quietHoursEnd: string;
	/** Suppress interruptive popups while another app is fullscreen. */
	pauseOnFullscreen: boolean;
	/** First-run setup completed or skipped; false until Finish/Skip. */
	hasCompletedOnboarding: boolean;
	/** UI language for settings and popups. */
	locale: Locale;
	/** Master switch for daily/weekly blink and tracking goals. */
	goalsEnabled: boolean;
	/** Daily blink target (0 = off). */
	dailyBlinkGoal: number;
	/** Daily tracking minutes target (0 = off). */
	dailyTrackingMinutesGoal: number;
	/** Weekly blink target Mon–Sun (0 = off). */
	weeklyBlinkGoal: number;
	/** Weekly tracking minutes target Mon–Sun (0 = off). */
	weeklyTrackingMinutesGoal: number;
}

export type AppPreferences = PersistedPreferences;

export type RendererPreferences = Omit<AppPreferences, "reminderInterval"> & {
	reminderInterval: number;
};

export const DEFAULT_EXERCISE_PROMPTS: readonly string[] =
	defaultExercisePrompts("en");

/** Coerce stored/IPC exercise prompts; never returns an empty list. */
export function sanitizeExercisePrompts(
	input: unknown,
	locale: Locale = "en",
): string[] {
	const fallback = defaultExercisePrompts(sanitizeLocale(locale));
	if (!Array.isArray(input)) {
		return [...fallback];
	}
	const cleaned = input
		.filter((item): item is string => typeof item === "string")
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
	return cleaned.length > 0 ? cleaned : [...fallback];
}

/** Coerce stored/IPC look-away title; empty → locale default. */
export function sanitizeLookAwayTitle(
	input: unknown,
	locale: Locale = "en",
): string {
	if (typeof input === "string" && input.trim()) {
		return input.trim();
	}
	return defaultLookAwayTitle(sanitizeLocale(locale));
}

/** Coerce stored/IPC look-away hint; empty → locale default. */
export function sanitizeLookAwayHint(
	input: unknown,
	locale: Locale = "en",
): string {
	if (typeof input === "string" && input.trim()) {
		return input.trim();
	}
	return defaultLookAwayHint(sanitizeLocale(locale));
}

export const DEFAULT_PREFERENCES: Readonly<PersistedPreferences> = {
	darkMode: true,
	reminderInterval: 3000,
	cameraEnabled: false,
	cameraQuality: "medium",
	autoStopNoFaceEnabled: true,
	autoStopNoFaceMinutes: AUTO_STOP_NO_FACE_MINUTES_DEFAULT,
	blinkRateCoachingEnabled: true,
	blinkRateThresholdPerMin: BLINK_RATE_LOW_MAX,
	earCalibration: null,
	eyeExercisesEnabled: true,
	exerciseInterval: 40,
	exercisePrompts: [...DEFAULT_EXERCISE_PROMPTS],
	lookAwayEnabled: true,
	lookAwayInterval: 20,
	lookAwayDuration: 20,
	lookAwayTitle: defaultLookAwayTitle("en"),
	lookAwayHint: defaultLookAwayHint("en"),
	popupPosition: null,
	popupSize: { width: 300, height: 120 },
	popupColors: {
		background: "#0F172A",
		text: "#F8FAFC",
		transparency: 0.15,
	},
	popupMessage: defaultPopupMessage("en"),
	blinkPopupClickThrough: true,
	keyboardShortcut: "Ctrl+I",
	mgdMode: false,
	soundEnabled: false,
	soundVolume: SOUND_VOLUME_DEFAULT,
	launchAtLogin: false,
	isTracking: false,
	quietHoursEnabled: true,
	quietHoursStart: "22:00",
	quietHoursEnd: "08:00",
	pauseOnFullscreen: true,
	hasCompletedOnboarding: false,
	locale: "en",
	goalsEnabled: DEFAULT_GOALS_CONFIG.goalsEnabled,
	dailyBlinkGoal: DEFAULT_GOALS_CONFIG.dailyBlinkGoal,
	dailyTrackingMinutesGoal: DEFAULT_GOALS_CONFIG.dailyTrackingMinutesGoal,
	weeklyBlinkGoal: DEFAULT_GOALS_CONFIG.weeklyBlinkGoal,
	weeklyTrackingMinutesGoal: DEFAULT_GOALS_CONFIG.weeklyTrackingMinutesGoal,
};

export function toRendererPreferences(
	preferences: AppPreferences,
): RendererPreferences {
	return {
		...preferences,
		reminderInterval: preferences.reminderInterval / 1000,
	};
}

const QUIET_HOURS_HH_MM = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

function parseQuietHoursMinutes(value: string): number | null {
	const match = QUIET_HOURS_HH_MM.exec(value.trim());
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (
		!Number.isInteger(hours) ||
		!Number.isInteger(minutes) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return null;
	}
	return hours * 60 + minutes;
}

function normalizeQuietHoursTime(value: string): string | null {
	const minutes = parseQuietHoursMinutes(value);
	if (minutes === null) return null;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function isCameraQualityValue(value: unknown): value is CameraQuality {
	return (
		value === "performance" || value === "medium" || value === "high"
	);
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function asFiniteNumber(value: unknown, fallback: number): number {
	const n = typeof value === "number" ? value : Number(value);
	return Number.isFinite(n) ? n : fallback;
}

function asPositiveMs(value: unknown, fallback: number): number {
	const n = asFiniteNumber(value, fallback);
	return n > 0 ? Math.round(n) : fallback;
}

function asPositiveMinutes(value: unknown, fallback: number): number {
	const n = asFiniteNumber(value, fallback);
	return n > 0 ? Math.round(n) : fallback;
}

function asPositiveSeconds(value: unknown, fallback: number): number {
	const n = asFiniteNumber(value, fallback);
	return n > 0 ? Math.round(n) : fallback;
}

function sanitizePopupPosition(value: unknown): Point | null {
	if (value === null || value === undefined) return null;
	if (!value || typeof value !== "object") return null;
	const record = value as Record<string, unknown>;
	const x = asFiniteNumber(record.x, Number.NaN);
	const y = asFiniteNumber(record.y, Number.NaN);
	if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
	return { x: Math.round(x), y: Math.round(y) };
}

function sanitizePopupSize(value: unknown, fallback: Size): Size {
	if (!value || typeof value !== "object") return { ...fallback };
	const record = value as Record<string, unknown>;
	const width = asFiniteNumber(record.width, fallback.width);
	const height = asFiniteNumber(record.height, fallback.height);
	return {
		width: Math.max(1, Math.round(width)),
		height: Math.max(1, Math.round(height)),
	};
}

function sanitizePopupColors(value: unknown, fallback: PopupColors): PopupColors {
	if (!value || typeof value !== "object") return { ...fallback };
	const record = value as Record<string, unknown>;
	const background =
		typeof record.background === "string" && record.background.trim()
			? record.background
			: fallback.background;
	const text =
		typeof record.text === "string" && record.text.trim()
			? record.text
			: fallback.text;
	const transparency = asFiniteNumber(record.transparency, fallback.transparency);
	return {
		background,
		text,
		transparency: Math.min(1, Math.max(0, transparency)),
	};
}

export type SanitizePersistedPreferencesOptions = {
	/** When true, always persist isTracking as false (backup import). */
	forceIsTrackingFalse?: boolean;
};

/**
 * Coerce arbitrary JSON into a full PersistedPreferences object.
 * Missing/invalid fields fall back to DEFAULT_PREFERENCES (and related sanitizers).
 */
export function sanitizePersistedPreferences(
	input: unknown,
	options?: SanitizePersistedPreferencesOptions,
): PersistedPreferences {
	const defaults = DEFAULT_PREFERENCES;
	const record =
		input && typeof input === "object"
			? (input as Record<string, unknown>)
			: {};

	const locale = sanitizeLocale(record.locale ?? defaults.locale);
	const earRaw = record.earCalibration;
	const earCalibration =
		earRaw === null
			? null
			: isValidEarCalibration(earRaw)
				? earRaw
				: defaults.earCalibration;

	const quietStartRaw =
		typeof record.quietHoursStart === "string"
			? record.quietHoursStart
			: defaults.quietHoursStart;
	const quietEndRaw =
		typeof record.quietHoursEnd === "string"
			? record.quietHoursEnd
			: defaults.quietHoursEnd;
	const quietHoursStart =
		normalizeQuietHoursTime(quietStartRaw) ?? defaults.quietHoursStart;
	const quietHoursEnd =
		normalizeQuietHoursTime(quietEndRaw) ?? defaults.quietHoursEnd;

	const goals = sanitizeGoalsConfig({
		goalsEnabled: record.goalsEnabled,
		dailyBlinkGoal: record.dailyBlinkGoal,
		dailyTrackingMinutesGoal: record.dailyTrackingMinutesGoal,
		weeklyBlinkGoal: record.weeklyBlinkGoal,
		weeklyTrackingMinutesGoal: record.weeklyTrackingMinutesGoal,
	});

	const isTracking = options?.forceIsTrackingFalse
		? false
		: asBoolean(record.isTracking, defaults.isTracking);

	return {
		darkMode: asBoolean(record.darkMode, defaults.darkMode),
		reminderInterval: asPositiveMs(
			record.reminderInterval,
			defaults.reminderInterval,
		),
		cameraEnabled: asBoolean(record.cameraEnabled, defaults.cameraEnabled),
		cameraQuality: isCameraQualityValue(record.cameraQuality)
			? record.cameraQuality
			: defaults.cameraQuality,
		autoStopNoFaceEnabled: asBoolean(
			record.autoStopNoFaceEnabled,
			defaults.autoStopNoFaceEnabled,
		),
		autoStopNoFaceMinutes: sanitizeAutoStopNoFaceMinutes(
			record.autoStopNoFaceMinutes,
		),
		blinkRateCoachingEnabled: asBoolean(
			record.blinkRateCoachingEnabled,
			defaults.blinkRateCoachingEnabled,
		),
		blinkRateThresholdPerMin: sanitizeBlinkRateThresholdPerMin(
			record.blinkRateThresholdPerMin,
		),
		earCalibration,
		eyeExercisesEnabled: asBoolean(
			record.eyeExercisesEnabled,
			defaults.eyeExercisesEnabled,
		),
		exerciseInterval: asPositiveMinutes(
			record.exerciseInterval,
			defaults.exerciseInterval,
		),
		exercisePrompts: sanitizeExercisePrompts(record.exercisePrompts, locale),
		lookAwayEnabled: asBoolean(record.lookAwayEnabled, defaults.lookAwayEnabled),
		lookAwayInterval: asPositiveMinutes(
			record.lookAwayInterval,
			defaults.lookAwayInterval,
		),
		lookAwayDuration: asPositiveSeconds(
			record.lookAwayDuration,
			defaults.lookAwayDuration,
		),
		lookAwayTitle: sanitizeLookAwayTitle(record.lookAwayTitle, locale),
		lookAwayHint: sanitizeLookAwayHint(record.lookAwayHint, locale),
		popupPosition: sanitizePopupPosition(record.popupPosition),
		popupSize: sanitizePopupSize(record.popupSize, defaults.popupSize),
		popupColors: sanitizePopupColors(record.popupColors, defaults.popupColors),
		popupMessage:
			typeof record.popupMessage === "string" && record.popupMessage.trim()
				? record.popupMessage
				: defaults.popupMessage,
		blinkPopupClickThrough: asBoolean(
			record.blinkPopupClickThrough,
			defaults.blinkPopupClickThrough,
		),
		keyboardShortcut:
			typeof record.keyboardShortcut === "string" &&
			record.keyboardShortcut.trim()
				? record.keyboardShortcut
				: defaults.keyboardShortcut,
		mgdMode: asBoolean(record.mgdMode, defaults.mgdMode),
		soundEnabled: asBoolean(record.soundEnabled, defaults.soundEnabled),
		soundVolume: sanitizeSoundVolume(record.soundVolume),
		launchAtLogin: asBoolean(record.launchAtLogin, defaults.launchAtLogin),
		isTracking,
		quietHoursEnabled: asBoolean(
			record.quietHoursEnabled,
			defaults.quietHoursEnabled,
		),
		quietHoursStart,
		quietHoursEnd,
		pauseOnFullscreen: asBoolean(
			record.pauseOnFullscreen,
			defaults.pauseOnFullscreen,
		),
		hasCompletedOnboarding: asBoolean(
			record.hasCompletedOnboarding,
			defaults.hasCompletedOnboarding,
		),
		locale,
		goalsEnabled: goals.goalsEnabled,
		dailyBlinkGoal: goals.dailyBlinkGoal,
		dailyTrackingMinutesGoal: goals.dailyTrackingMinutesGoal,
		weeklyBlinkGoal: goals.weeklyBlinkGoal,
		weeklyTrackingMinutesGoal: goals.weeklyTrackingMinutesGoal,
	};
}
