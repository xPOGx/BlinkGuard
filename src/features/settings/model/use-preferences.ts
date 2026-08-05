import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { useEffect, useState } from "react";
import type { RendererPreferences } from "../../../../shared/preferences";
import {
	DEFAULT_RENDERER_PREFERENCES,
	type SettingsPreferences,
} from "./preferences";

export type SetPreferences = React.Dispatch<
	React.SetStateAction<SettingsPreferences>
>;

export function usePreferences() {
	const [preferences, setPreferences] = useState<SettingsPreferences>(
		DEFAULT_RENDERER_PREFERENCES,
	);

	useEffect(
		() =>
			rendererIpc.onPreferences((saved: RendererPreferences) => {
				setPreferences((current) => ({ ...current, ...saved }));
			}),
		[],
	);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", preferences.darkMode);
		rendererIpc.updateDarkMode(preferences.darkMode);
		rendererIpc.updateCameraEnabled(preferences.cameraEnabled);
		rendererIpc.updateEyeExercisesEnabled(preferences.eyeExercisesEnabled);
		rendererIpc.updateExerciseInterval(preferences.exerciseInterval);
		rendererIpc.updatePopupColors(preferences.popupColors);
		rendererIpc.updatePopupTransparency(preferences.popupColors.transparency);
		rendererIpc.updatePopupMessage(preferences.popupMessage);
		rendererIpc.updateKeyboardShortcut(preferences.keyboardShortcut);
		rendererIpc.updateSoundEnabled(preferences.soundEnabled);
	}, [preferences]);

	useEffect(() => {
		if (!preferences.isTracking) {
			rendererIpc.updateReminderInterval(preferences.reminderInterval);
		}
	}, [preferences.isTracking, preferences.reminderInterval]);

	const toggleTracking = () => {
		setPreferences((current) => ({
			...current,
			isTracking: !current.isTracking,
		}));
		if (preferences.isTracking) {
			rendererIpc.stopReminders();
		} else {
			rendererIpc.startReminders(preferences.reminderInterval);
		}
	};

	const changeReminderInterval = (reminderInterval: number) => {
		if (preferences.isTracking) {
			rendererIpc.stopReminders();
		}
		setPreferences((current) => ({
			...current,
			isTracking: false,
			reminderInterval,
		}));
	};

	return {
		preferences,
		setPreferences,
		toggleTracking,
		changeReminderInterval,
	};
}
