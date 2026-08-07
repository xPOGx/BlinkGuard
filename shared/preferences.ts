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

export interface PersistedPreferences {
	darkMode: boolean;
	reminderInterval: number;
	cameraEnabled: boolean;
	cameraQuality: CameraQuality;
	/** Personal open-eye EAR baseline; null when unset. */
	earCalibration: number | null;
	/** Experimental: request MediaPipe backend (falls back to dlib if unbundled). */
	useMediaPipe: boolean;
	eyeExercisesEnabled: boolean;
	exerciseInterval: number;
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
}

export type AppPreferences = PersistedPreferences;

export type RendererPreferences = Omit<AppPreferences, "reminderInterval"> & {
	reminderInterval: number;
};

export const DEFAULT_PREFERENCES: Readonly<PersistedPreferences> = {
	darkMode: true,
	reminderInterval: 3000,
	cameraEnabled: false,
	cameraQuality: "medium",
	earCalibration: null,
	useMediaPipe: false,
	eyeExercisesEnabled: true,
	exerciseInterval: 20,
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
	popupMessage: "Blink!",
	keyboardShortcut: "Ctrl+I",
	mgdMode: false,
	soundEnabled: false,
	launchAtLogin: false,
	isTracking: false,
	quietHoursEnabled: true,
	quietHoursStart: "22:00",
	quietHoursEnd: "08:00",
	pauseOnFullscreen: true,
};

export function toRendererPreferences(
	preferences: AppPreferences,
): RendererPreferences {
	return {
		...preferences,
		reminderInterval: preferences.reminderInterval / 1000,
	};
}
