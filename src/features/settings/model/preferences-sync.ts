import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type { Point, Size } from "../../../../shared/preferences";
import type { SettingsPreferences } from "./preferences";

export function sameStringArray(a: string[], b: string[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function samePopupColors(
	a: SettingsPreferences["popupColors"],
	b: SettingsPreferences["popupColors"],
): boolean {
	return (
		a.background === b.background &&
		a.text === b.text &&
		a.transparency === b.transparency
	);
}

export function samePoint(a: Point | null, b: Point | null): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.x === b.x && a.y === b.y;
}

export function sameSize(a: Size, b: Size): boolean {
	return a.width === b.width && a.height === b.height;
}

/**
 * Compare persisted renderer fields only (ignore UI-only flags like showMgdInfo).
 * Used to block main↔renderer preference echo loops.
 */
export function sameRendererPrefs(
	a: SettingsPreferences,
	b: SettingsPreferences,
): boolean {
	return (
		a.darkMode === b.darkMode &&
		a.reminderInterval === b.reminderInterval &&
		a.cameraEnabled === b.cameraEnabled &&
		a.cameraQuality === b.cameraQuality &&
		a.autoStopNoFaceEnabled === b.autoStopNoFaceEnabled &&
		a.autoStopNoFaceMinutes === b.autoStopNoFaceMinutes &&
		a.blinkRateCoachingEnabled === b.blinkRateCoachingEnabled &&
		a.blinkRateThresholdPerMin === b.blinkRateThresholdPerMin &&
		a.earCalibration === b.earCalibration &&
		a.eyeExercisesEnabled === b.eyeExercisesEnabled &&
		a.exerciseInterval === b.exerciseInterval &&
		sameStringArray(a.exercisePrompts, b.exercisePrompts) &&
		a.lookAwayEnabled === b.lookAwayEnabled &&
		a.lookAwayInterval === b.lookAwayInterval &&
		a.lookAwayDuration === b.lookAwayDuration &&
		a.popupMessage === b.popupMessage &&
		samePopupColors(a.popupColors, b.popupColors) &&
		samePoint(a.popupPosition, b.popupPosition) &&
		sameSize(a.popupSize, b.popupSize) &&
		a.keyboardShortcut === b.keyboardShortcut &&
		a.mgdMode === b.mgdMode &&
		a.soundEnabled === b.soundEnabled &&
		a.soundVolume === b.soundVolume &&
		a.launchAtLogin === b.launchAtLogin &&
		a.isTracking === b.isTracking &&
		a.quietHoursEnabled === b.quietHoursEnabled &&
		a.quietHoursStart === b.quietHoursStart &&
		a.quietHoursEnd === b.quietHoursEnd &&
		a.pauseOnFullscreen === b.pauseOnFullscreen &&
		a.hasCompletedOnboarding === b.hasCompletedOnboarding &&
		a.locale === b.locale
	);
}

/** Push only fields that changed. Never call update* for unchanged values. */
export function pushPreferenceDiff(
	previous: SettingsPreferences | null,
	next: SettingsPreferences,
): void {
	if (!previous || previous.darkMode !== next.darkMode) {
		rendererIpc.updateDarkMode(next.darkMode);
	}
	if (!previous || previous.cameraEnabled !== next.cameraEnabled) {
		rendererIpc.updateCameraEnabled(next.cameraEnabled);
	}
	if (!previous || previous.cameraQuality !== next.cameraQuality) {
		rendererIpc.updateCameraQuality(next.cameraQuality);
	}
	if (
		!previous ||
		previous.autoStopNoFaceEnabled !== next.autoStopNoFaceEnabled
	) {
		rendererIpc.updateAutoStopNoFaceEnabled(next.autoStopNoFaceEnabled);
	}
	if (
		!previous ||
		previous.autoStopNoFaceMinutes !== next.autoStopNoFaceMinutes
	) {
		rendererIpc.updateAutoStopNoFaceMinutes(next.autoStopNoFaceMinutes);
	}
	if (!previous || previous.earCalibration !== next.earCalibration) {
		rendererIpc.updateEarCalibration(next.earCalibration);
	}
	if (!previous || previous.eyeExercisesEnabled !== next.eyeExercisesEnabled) {
		rendererIpc.updateEyeExercisesEnabled(next.eyeExercisesEnabled);
	}
	if (!previous || previous.exerciseInterval !== next.exerciseInterval) {
		rendererIpc.updateExerciseInterval(next.exerciseInterval);
	}
	if (
		!previous ||
		!sameStringArray(previous.exercisePrompts, next.exercisePrompts)
	) {
		rendererIpc.updateExercisePrompts(next.exercisePrompts);
	}
	if (!previous || previous.lookAwayEnabled !== next.lookAwayEnabled) {
		rendererIpc.updateLookAwayEnabled(next.lookAwayEnabled);
	}
	if (!previous || previous.lookAwayInterval !== next.lookAwayInterval) {
		rendererIpc.updateLookAwayInterval(next.lookAwayInterval);
	}
	if (!previous || previous.lookAwayDuration !== next.lookAwayDuration) {
		rendererIpc.updateLookAwayDuration(next.lookAwayDuration);
	}
	if (!previous || !samePopupColors(previous.popupColors, next.popupColors)) {
		rendererIpc.updatePopupColors(next.popupColors);
		rendererIpc.updatePopupTransparency(next.popupColors.transparency);
	}
	if (!previous || previous.popupMessage !== next.popupMessage) {
		rendererIpc.updatePopupMessage(next.popupMessage);
	}
	if (!previous || previous.keyboardShortcut !== next.keyboardShortcut) {
		rendererIpc.updateKeyboardShortcut(next.keyboardShortcut);
	}
	if (!previous || previous.mgdMode !== next.mgdMode) {
		rendererIpc.updateMgdMode(next.mgdMode);
	}
	if (!previous || previous.soundEnabled !== next.soundEnabled) {
		rendererIpc.updateSoundEnabled(next.soundEnabled);
	}
	if (!previous || previous.soundVolume !== next.soundVolume) {
		rendererIpc.updateSoundVolume(next.soundVolume);
	}
	if (!previous || previous.launchAtLogin !== next.launchAtLogin) {
		rendererIpc.updateLaunchAtLogin(next.launchAtLogin);
	}
	if (!previous || previous.quietHoursEnabled !== next.quietHoursEnabled) {
		rendererIpc.updateQuietHoursEnabled(next.quietHoursEnabled);
	}
	if (!previous || previous.quietHoursStart !== next.quietHoursStart) {
		rendererIpc.updateQuietHoursStart(next.quietHoursStart);
	}
	if (!previous || previous.quietHoursEnd !== next.quietHoursEnd) {
		rendererIpc.updateQuietHoursEnd(next.quietHoursEnd);
	}
	if (!previous || previous.pauseOnFullscreen !== next.pauseOnFullscreen) {
		rendererIpc.updatePauseOnFullscreen(next.pauseOnFullscreen);
	}
	if (
		!previous ||
		previous.blinkRateCoachingEnabled !== next.blinkRateCoachingEnabled
	) {
		rendererIpc.updateBlinkRateCoachingEnabled(next.blinkRateCoachingEnabled);
	}
	if (
		!previous ||
		previous.blinkRateThresholdPerMin !== next.blinkRateThresholdPerMin
	) {
		rendererIpc.updateBlinkRateThreshold(next.blinkRateThresholdPerMin);
	}
	if (!previous || previous.locale !== next.locale) {
		rendererIpc.updateLocale(next.locale);
	}
	if (
		!previous ||
		previous.hasCompletedOnboarding !== next.hasCompletedOnboarding
	) {
		rendererIpc.updateHasCompletedOnboarding(next.hasCompletedOnboarding);
	}
}
