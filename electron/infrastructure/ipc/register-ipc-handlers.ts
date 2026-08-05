import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import type {
	Point,
	PopupColors,
	Size,
} from "../../../shared/preferences";
import type { ExerciseService } from "../../application/exercise-service";
import type { PreferencesService } from "../../application/preferences-service";
import type { ReminderService } from "../../application/reminder-service";
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
}

export function registerIpcHandlers(deps: IpcDependencies): void {
	const { preferences, reminders, exercises, sidecar, shortcuts, windows } =
		deps;
	const current = preferences.current;

	ipcMain.on(IPC_CHANNELS.blinkDetected, () => reminders.onBlink());
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
	});
	ipcMain.on(IPC_CHANNELS.updateSoundEnabled, (_event, enabled: boolean) => {
		preferences.set("soundEnabled", enabled);
	});
	ipcMain.on(IPC_CHANNELS.showCameraWindow, () => {
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
		preferences.reset(getCenteredPopupPosition(300, 120));
		shortcuts.register(current.keyboardShortcut);
		windows.sendPreferences();
	});
}
