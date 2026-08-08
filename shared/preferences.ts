import { BLINK_RATE_LOW_MAX } from "./blink-rate";
import {
	defaultExercisePrompts,
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
	popupPosition: Point | null;
	popupSize: Size;
	popupColors: PopupColors;
	popupMessage: string;
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
	exerciseInterval: 20,
	exercisePrompts: [...DEFAULT_EXERCISE_PROMPTS],
	lookAwayEnabled: true,
	lookAwayInterval: 20,
	lookAwayDuration: 20,
	popupPosition: null,
	popupSize: { width: 300, height: 120 },
	popupColors: {
		background: "#0F172A",
		text: "#F8FAFC",
		transparency: 0.15,
	},
	popupMessage: defaultPopupMessage("en"),
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
};

export function toRendererPreferences(
	preferences: AppPreferences,
): RendererPreferences {
	return {
		...preferences,
		reminderInterval: preferences.reminderInterval / 1000,
	};
}
