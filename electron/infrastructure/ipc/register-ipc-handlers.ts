import { ipcMain } from "electron";
import { isValidEarCalibration } from "../../../shared/ear-calibration";
import { isCameraQuality } from "../../../shared/camera-quality";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import type {
	CameraQuality,
	Point,
	PopupColors,
	Size,
} from "../../../shared/preferences";
import type { BlinkStatsService } from "../../application/blink-stats-service";
import type { ExerciseService } from "../../application/exercise-service";
import type { PreferencesService } from "../../application/preferences-service";
import type { ReminderService } from "../../application/reminder-service";
import { applyLaunchAtLogin } from "../lifecycle/login-item";
import type { BlinkDetectorSidecar } from "../sidecar/blink-detector-sidecar";
import type { ShortcutController } from "../shortcuts/shortcut-controller";
import type { WindowManager } from "../windows/window-manager";
import { getCenteredPopupPosition } from "../windows/window-position";

interface IpcDependencies {
	preferences: PreferencesService;
	reminders: ReminderService;
	exercises: ExerciseService;
	sidecar: BlinkDetectorSidecar;
	shortcuts: ShortcutController;
	windows: WindowManager;
	blinkStats: BlinkStatsService;
}

export function registerIpcHandlers(deps: IpcDependencies): void {
	const {
		preferences,
		reminders,
		exercises,
		sidecar,
		shortcuts,
		windows,
		blinkStats,
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
	ipcMain.on(IPC_CHANNELS.updateUseMediaPipe, (_event, enabled: boolean) => {
		const next = Boolean(enabled);
		const changed = current.useMediaPipe !== next;
		preferences.set("useMediaPipe", next);
		sidecar.applyDetectorBackend(next, changed && next);
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
	ipcMain.on(IPC_CHANNELS.resetPreferences, () => {
		if (current.isTracking) reminders.stop(true);
		exercises.stop();
		sidecar.cancelEarCalibration("Preferences reset");
		preferences.reset(getCenteredPopupPosition(300, 120));
		applyLaunchAtLogin(false);
		shortcuts.register(current.keyboardShortcut);
		sidecar.applyCameraQuality(current.cameraQuality);
		sidecar.applyEarCalibration(null);
		sidecar.applyDetectorBackend(false, false);
		windows.sendPreferences();
	});
	ipcMain.on(IPC_CHANNELS.requestBlinkStats, () => {
		windows.sendToMain(IPC_CHANNELS.loadBlinkStats, blinkStats.getSnapshot());
	});
	ipcMain.on(IPC_CHANNELS.resetBlinkStats, () => {
		blinkStats.reset();
		windows.sendToMain(IPC_CHANNELS.loadBlinkStats, blinkStats.getSnapshot());
	});
}
