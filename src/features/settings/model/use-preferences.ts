import { useEffect, useState } from "react";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
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
	const [prefsHydrated, setPrefsHydrated] = useState(false);

	useEffect(
		() =>
			rendererIpc.onPreferences((saved: RendererPreferences) => {
				setPreferences((current) => ({ ...current, ...saved }));
				setPrefsHydrated(true);
			}),
		[],
	);

	useEffect(() => {
		// Wait for main → renderer hydrate so defaults do not overwrite the store
		// (e.g. hasCompletedOnboarding: false) or bounce sendPreferences loops.
		if (!prefsHydrated) return;

		document.documentElement.classList.toggle("dark", preferences.darkMode);
		rendererIpc.updateDarkMode(preferences.darkMode);
		rendererIpc.updateCameraEnabled(preferences.cameraEnabled);
		rendererIpc.updateCameraQuality(preferences.cameraQuality);
		rendererIpc.updateEyeExercisesEnabled(preferences.eyeExercisesEnabled);
		rendererIpc.updateExerciseInterval(preferences.exerciseInterval);
		rendererIpc.updateExercisePrompts(preferences.exercisePrompts);
		rendererIpc.updateLookAwayEnabled(preferences.lookAwayEnabled);
		rendererIpc.updateLookAwayInterval(preferences.lookAwayInterval);
		rendererIpc.updateLookAwayDuration(preferences.lookAwayDuration);
		rendererIpc.updatePopupColors(preferences.popupColors);
		rendererIpc.updatePopupTransparency(preferences.popupColors.transparency);
		rendererIpc.updatePopupMessage(preferences.popupMessage);
		rendererIpc.updateKeyboardShortcut(preferences.keyboardShortcut);
		rendererIpc.updateSoundEnabled(preferences.soundEnabled);
		rendererIpc.updateLaunchAtLogin(preferences.launchAtLogin);
		rendererIpc.updateQuietHoursEnabled(preferences.quietHoursEnabled);
		rendererIpc.updateQuietHoursStart(preferences.quietHoursStart);
		rendererIpc.updateQuietHoursEnd(preferences.quietHoursEnd);
		rendererIpc.updatePauseOnFullscreen(preferences.pauseOnFullscreen);
		rendererIpc.updateBlinkRateCoachingEnabled(
			preferences.blinkRateCoachingEnabled,
		);
		rendererIpc.updateBlinkRateThreshold(preferences.blinkRateThresholdPerMin);
		rendererIpc.updateHasCompletedOnboarding(
			preferences.hasCompletedOnboarding,
		);
	}, [preferences, prefsHydrated]);

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
		prefsHydrated,
		toggleTracking,
		changeReminderInterval,
	};
}
