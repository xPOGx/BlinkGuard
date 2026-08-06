import {
	DEFAULT_PREFERENCES,
	type RendererPreferences,
} from "../../../../shared/preferences";

export interface SettingsPreferences extends RendererPreferences {
	showMgdInfo: boolean;
	showPopupColors: boolean;
}

export const DEFAULT_RENDERER_PREFERENCES: SettingsPreferences = {
	...DEFAULT_PREFERENCES,
	reminderInterval: DEFAULT_PREFERENCES.reminderInterval / 1000,
	showMgdInfo: false,
	showPopupColors: false,
};
