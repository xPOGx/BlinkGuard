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

export interface PersistedPreferences {
	darkMode: boolean;
	reminderInterval: number;
	cameraEnabled: boolean;
	eyeExercisesEnabled: boolean;
	exerciseInterval: number;
	popupPosition: Point | null;
	popupSize: Size;
	popupColors: PopupColors;
	popupMessage: string;
	keyboardShortcut: string;
	mgdMode: boolean;
	soundEnabled: boolean;
}

export interface AppPreferences extends PersistedPreferences {
	isTracking: boolean;
}

export type RendererPreferences = Omit<AppPreferences, "reminderInterval"> & {
	reminderInterval: number;
};

export const DEFAULT_PREFERENCES: Readonly<PersistedPreferences> = {
	darkMode: true,
	reminderInterval: 3000,
	cameraEnabled: false,
	eyeExercisesEnabled: true,
	exerciseInterval: 20,
	popupPosition: null,
	popupSize: { width: 300, height: 120 },
	popupColors: {
		background: "#FFFFFF",
		text: "#00FF11",
		transparency: 0.3,
	},
	popupMessage: "Blink!",
	keyboardShortcut: "Ctrl+I",
	mgdMode: false,
	soundEnabled: false,
};

export function toRendererPreferences(
	preferences: AppPreferences,
): RendererPreferences {
	return {
		...preferences,
		reminderInterval: preferences.reminderInterval / 1000,
	};
}
