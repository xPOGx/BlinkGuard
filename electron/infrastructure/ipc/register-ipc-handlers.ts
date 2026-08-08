import { ipcMain } from "electron";
import { isValidEarCalibration } from "../../../shared/ear-calibration";
import { isCameraQuality } from "../../../shared/camera-quality";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import {
	defaultExercisePrompts,
	defaultPopupMessage,
	isBuiltInExercisePrompts,
	isBuiltInPopupMessage,
	sanitizeLocale,
} from "../../../shared/i18n";
import type {
	CameraQuality,
	Point,
	PopupColors,
	Size,
} from "../../../shared/preferences";
import type { BlinkStatsService } from "../../application/blink-stats-service";
import type { ExerciseService } from "../../application/exercise-service";
import type { FocusPauseService } from "../../application/focus-pause-service";
import type { LookAwayService } from "../../application/look-away-service";
import type { PreferencesService } from "../../application/preferences-service";
import type { ReminderService } from "../../application/reminder-service";
import { normalizeQuietHoursTime } from "../../domain/focus-policy";
import { applyLaunchAtLogin } from "../lifecycle/login-item";
import type { BlinkDetectorSidecar } from "../sidecar/blink-detector-sidecar";
import type { ShortcutController } from "../shortcuts/shortcut-controller";
import type { TrayController } from "../tray/tray-controller";
import type { WindowManager } from "../windows/window-manager";

interface IpcDependencies {
	preferences: PreferencesService;
	reminders: ReminderService;
	exercises: ExerciseService;
	lookAway: LookAwayService;
	sidecar: BlinkDetectorSidecar;
	shortcuts: ShortcutController;
	windows: WindowManager;
	blinkStats: BlinkStatsService;
	focusPause: FocusPauseService;
	tray?: TrayController;
}

export function registerIpcHandlers(deps: IpcDependencies): void {
	const {
		preferences,
		reminders,
		exercises,
		lookAway,
		sidecar,
		shortcuts,
		windows,
		blinkStats,
		focusPause,
		tray,
	} = deps;
	const current = preferences.current;

	ipcMain.on(IPC_CHANNELS.startBlinkReminders, (_event, interval: number) => {
		reminders.start(interval);
	});
	ipcMain.on(IPC_CHANNELS.stopBlinkReminders, () => reminders.stop(true));
	ipcMain.on(IPC_CHANNELS.updatePopupPosition, (_event, position: Point) => {
		preferences.set("popupPosition", position);
	});
	ipcMain.on(IPC_CHANNELS.updateInterval, (_event, interval: number) => {
		preferences.set("reminderInterval", interval);
	});
	ipcMain.on(
		IPC_CHANNELS.updatePopupColors,
		(_event, colors: PopupColors) => {
			preferences.set("popupColors", colors);
			windows.applyPopupAppearance();
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updatePopupTransparency,
		(_event, transparency: number) => {
			current.popupColors.transparency = transparency;
			preferences.set("popupColors", current.popupColors);
			windows.applyPopupAppearance();
		},
	);
	ipcMain.on(IPC_CHANNELS.updatePopupMessage, (_event, message: string) => {
		preferences.set("popupMessage", message);
	});
	ipcMain.on(IPC_CHANNELS.updateDarkMode, (_event, enabled: boolean) => {
		preferences.set("darkMode", enabled);
	});
	ipcMain.on(IPC_CHANNELS.updateCameraEnabled, (_event, enabled: boolean) => {
		preferences.set("cameraEnabled", enabled);
		if (windows.reminder && !windows.reminder.isDestroyed()) {
			windows.reminder.webContents.send(IPC_CHANNELS.cameraMode, enabled);
		}
	});
	ipcMain.on(
		IPC_CHANNELS.updateCameraQuality,
		(_event, quality: CameraQuality) => {
			if (!isCameraQuality(quality)) return;
			preferences.set("cameraQuality", quality);
			sidecar.applyCameraQuality(quality);
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateEarCalibration,
		(_event, baseline: number | null) => {
			if (baseline === null) {
				preferences.set("earCalibration", null);
				sidecar.applyEarCalibration(null);
				return;
			}
			if (!isValidEarCalibration(baseline)) return;
			preferences.set("earCalibration", baseline);
			sidecar.applyEarCalibration(baseline);
		},
	);
	ipcMain.on(IPC_CHANNELS.startEarCalibration, () => {
		if (!current.cameraEnabled) {
			preferences.set("cameraEnabled", true);
		}
		reminders.ensureCameraActive();
		sidecar.startEarCalibration();
	});
	ipcMain.on(IPC_CHANNELS.cancelEarCalibration, () => {
		sidecar.cancelEarCalibration();
	});
	ipcMain.on(
		IPC_CHANNELS.updateEyeExercisesEnabled,
		(_event, enabled: boolean) => {
			preferences.set("eyeExercisesEnabled", enabled);
			if (enabled) exercises.start();
			else exercises.stop();
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateExerciseInterval,
		(_event, interval: number) => {
			preferences.set("exerciseInterval", interval);
			if (current.eyeExercisesEnabled) {
				exercises.stop();
				exercises.start();
			}
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateExercisePrompts,
		(_event, prompts: unknown) => {
			preferences.set("exercisePrompts", prompts as string[]);
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateLookAwayEnabled,
		(_event, enabled: boolean) => {
			preferences.set("lookAwayEnabled", enabled);
			if (enabled) lookAway.start();
			else lookAway.stop();
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateLookAwayInterval,
		(_event, interval: number) => {
			preferences.set("lookAwayInterval", interval);
			if (current.lookAwayEnabled) {
				lookAway.stop();
				lookAway.start();
			}
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateLookAwayDuration,
		(_event, duration: number) => {
			preferences.set("lookAwayDuration", duration);
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateKeyboardShortcut,
		(_event, shortcut: string) => {
			preferences.set("keyboardShortcut", shortcut);
			shortcuts.register(shortcut);
		},
	);
	ipcMain.on(IPC_CHANNELS.startCameraTracking, () => {
		if (current.isTracking) reminders.stop(true);
		preferences.set("cameraEnabled", true);
	});
	ipcMain.on(IPC_CHANNELS.stopCameraTracking, () => {
		if (current.isTracking) reminders.stop(true);
		preferences.set("cameraEnabled", false);
	});
	ipcMain.on(IPC_CHANNELS.skipExercise, () => exercises.skip());
	ipcMain.on(IPC_CHANNELS.snoozeExercise, () => exercises.snooze());
	ipcMain.on(IPC_CHANNELS.skipLookAway, () => lookAway.skip());
	ipcMain.on(IPC_CHANNELS.snoozeLookAway, () => lookAway.snooze());
	ipcMain.on(IPC_CHANNELS.snoozeBlink, () => reminders.snooze());
	ipcMain.on(IPC_CHANNELS.updateMgdMode, (_event, enabled: boolean) => {
		preferences.set("mgdMode", enabled);
		reminders.syncCameraLoopForMgdMode();
	});
	ipcMain.on(IPC_CHANNELS.updateSoundEnabled, (_event, enabled: boolean) => {
		preferences.set("soundEnabled", enabled);
	});
	ipcMain.on(IPC_CHANNELS.updateLaunchAtLogin, (_event, enabled: boolean) => {
		preferences.set("launchAtLogin", enabled);
		applyLaunchAtLogin(enabled);
	});
	ipcMain.on(
		IPC_CHANNELS.updateHasCompletedOnboarding,
		(_event, completed: boolean) => {
			preferences.set("hasCompletedOnboarding", Boolean(completed));
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateQuietHoursEnabled,
		(_event, enabled: boolean) => {
			preferences.set("quietHoursEnabled", Boolean(enabled));
			focusPause.recompute();
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateQuietHoursStart,
		(_event, value: string) => {
			const normalized = normalizeQuietHoursTime(value);
			if (!normalized) return;
			preferences.set("quietHoursStart", normalized);
			focusPause.recompute();
		},
	);
	ipcMain.on(IPC_CHANNELS.updateQuietHoursEnd, (_event, value: string) => {
		const normalized = normalizeQuietHoursTime(value);
		if (!normalized) return;
		preferences.set("quietHoursEnd", normalized);
		focusPause.recompute();
	});
	ipcMain.on(
		IPC_CHANNELS.updatePauseOnFullscreen,
		(_event, enabled: boolean) => {
			preferences.set("pauseOnFullscreen", Boolean(enabled));
			focusPause.recompute();
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateBlinkRateCoachingEnabled,
		(_event, enabled: boolean) => {
			preferences.set("blinkRateCoachingEnabled", Boolean(enabled));
		},
	);
	ipcMain.on(
		IPC_CHANNELS.updateBlinkRateThreshold,
		(_event, threshold: number) => {
			preferences.set("blinkRateThresholdPerMin", threshold);
		},
	);
	ipcMain.on(IPC_CHANNELS.updateLocale, (_event, value: string) => {
		const locale = sanitizeLocale(value);
		preferences.set("locale", locale);
		if (isBuiltInPopupMessage(current.popupMessage)) {
			preferences.set("popupMessage", defaultPopupMessage(locale));
		}
		if (isBuiltInExercisePrompts(current.exercisePrompts)) {
			preferences.set("exercisePrompts", defaultExercisePrompts(locale));
		}
		tray?.rebuildMenu(locale);
		blinkStats.invalidateCharts();
		windows.sendPreferences();
		if (blinkStats.isLivePushEnabled()) {
			windows.sendToMain(IPC_CHANNELS.loadBlinkStats, blinkStats.getSnapshot());
		}
	});
	ipcMain.on(IPC_CHANNELS.showCameraWindow, () => {
		if (!current.cameraEnabled) {
			preferences.set("cameraEnabled", true);
		}
		reminders.ensureCameraActive();
		windows.sendPreferences();
		windows.showCamera(() => {
			windows.sendToMain(IPC_CHANNELS.cameraWindowClosed);
		});
	});
	ipcMain.on(IPC_CHANNELS.closeCameraWindow, () => windows.closeCamera());
	ipcMain.on(IPC_CHANNELS.requestVideoStream, () => sidecar.requestVideo());
	ipcMain.on(IPC_CHANNELS.showPopupEditor, () => windows.showEditor());
	ipcMain.on(
		IPC_CHANNELS.popupEditorSaved,
		(_event, value: { size: Size; position: Point }) => {
			preferences.set("popupSize", value.size);
			preferences.set("popupPosition", value.position);
			windows.applyPopupGeometry(value.size, value.position);
			windows.sendPreferences();
		},
	);
	ipcMain.on(
		IPC_CHANNELS.resetPreferences,
		(_event, replayOnboarding?: boolean) => {
			if (current.isTracking) reminders.stop(true);
			exercises.stop();
			lookAway.stop();
			sidecar.cancelEarCalibration("Preferences reset");
			preferences.reset(null, {
				replayOnboarding: Boolean(replayOnboarding),
			});
			applyLaunchAtLogin(false);
			shortcuts.register(current.keyboardShortcut);
			sidecar.applyCameraQuality(current.cameraQuality);
			sidecar.applyEarCalibration(null);
			windows.sendPreferences();
			focusPause.recompute();
		},
	);
	ipcMain.on(IPC_CHANNELS.requestBlinkStats, () => {
		windows.sendToMain(IPC_CHANNELS.loadBlinkStats, blinkStats.getSnapshot());
	});
	ipcMain.on(IPC_CHANNELS.subscribeBlinkStats, () => {
		blinkStats.setLivePushEnabled(true);
	});
	ipcMain.on(IPC_CHANNELS.unsubscribeBlinkStats, () => {
		blinkStats.setLivePushEnabled(false);
	});
	ipcMain.on(IPC_CHANNELS.resetBlinkStats, () => {
		blinkStats.reset();
		windows.sendToMain(IPC_CHANNELS.loadBlinkStats, blinkStats.getSnapshot());
	});
}
