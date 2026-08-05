import { app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppRuntimeState } from "./application/app-runtime-state";
import { ExerciseService } from "./application/exercise-service";
import { PreferencesService } from "./application/preferences-service";
import { ReminderService } from "./application/reminder-service";
import { AppLifecycle } from "./infrastructure/lifecycle/app-lifecycle";
import { registerIpcHandlers } from "./infrastructure/ipc/register-ipc-handlers";
import { configureFileLogging } from "./infrastructure/logging/configure-file-logging";
import { configureAppPaths } from "./infrastructure/paths/app-paths";
import { ChildProcessRegistry } from "./infrastructure/process/child-process-registry";
import { ProcessCleanup } from "./infrastructure/process/process-cleanup";
import { BlinkDetectorSidecar } from "./infrastructure/sidecar/blink-detector-sidecar";
import { ShortcutController } from "./infrastructure/shortcuts/shortcut-controller";
import { NotificationSoundPlayer } from "./infrastructure/sound/notification-sound-player";
import { ElectronPreferenceStore } from "./infrastructure/store/electron-preference-store";
import { WindowManager } from "./infrastructure/windows/window-manager";
import { getCenteredPopupPosition } from "./infrastructure/windows/window-position";
import { IPC_CHANNELS } from "../shared/ipc-channels";

if (process.platform === "darwin") {
	process.env.NSWindowSupportsNonactivatingPanel = "true";
}
configureFileLogging();

const entryDirectory = path.dirname(fileURLToPath(import.meta.url));
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const paths = configureAppPaths(entryDirectory, VITE_DEV_SERVER_URL);
export const MAIN_DIST = paths.mainDist;
export const RENDERER_DIST = paths.rendererDist;

const store = new ElectronPreferenceStore();
const preferencesService = new PreferencesService(store);
const preferences = preferencesService.current;
const state = new AppRuntimeState();
const processes = new ChildProcessRegistry();
const windows = new WindowManager(paths, preferences, VITE_DEV_SERVER_URL);
const sound = new NotificationSoundPlayer(paths, preferences, app.isPackaged);

let reminders: ReminderService;
const sidecar = new BlinkDetectorSidecar(
	paths,
	app.isPackaged,
	processes,
	{
		onBlink: (data) => {
			reminders.onBlink();
			windows.sendToCamera(IPC_CHANNELS.blinkDetected, data);
		},
		onFaceData: (data: any) => {
			reminders.onFaceDetection(!!data.faceDetected);
			windows.sendToCamera(IPC_CHANNELS.faceTrackingData, data);
		},
		onVideoStream: (data) => {
			windows.sendToCamera(IPC_CHANNELS.videoStream, data);
		},
		onError: (message) => {
			windows.sendToMain(IPC_CHANNELS.cameraError, message);
		},
		shouldRetryCamera: () =>
			preferences.isTracking && preferences.cameraEnabled,
	},
);
reminders = new ReminderService(preferences, state, windows, sidecar, sound);
const exercises = new ExerciseService(
	preferences,
	state,
	store,
	windows,
	sound,
);
const shortcuts = new ShortcutController(
	preferences,
	state,
	reminders,
	windows,
);
const lifecycle = new AppLifecycle(
	preferences,
	state,
	reminders,
	exercises,
	windows,
	new ProcessCleanup(processes),
);

registerIpcHandlers({
	preferences: preferencesService,
	reminders,
	exercises,
	sidecar,
	shortcuts,
	windows,
});

app.on("activate", () => windows.activateMain(lifecycle.handleMainClose));

void app.whenReady().then(() => {
	lifecycle.register();
	windows.createMain(lifecycle.handleMainClose);
	shortcuts.register(preferences.keyboardShortcut);

	if (!store.has("popupPosition")) {
		preferences.popupPosition = getCenteredPopupPosition(300, 120);
		store.set("popupPosition", preferences.popupPosition);
	} else {
		preferences.popupPosition = store.get("popupPosition");
	}

	exercises.resetTimer();
	if (preferences.eyeExercisesEnabled) exercises.start();

	console.log("Starting blink detector on app startup...");
	sidecar.start();
});
