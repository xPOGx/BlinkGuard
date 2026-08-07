import { app } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppRuntimeState } from "./application/app-runtime-state";
import { BlinkStatsService } from "./application/blink-stats-service";
import { ExerciseService } from "./application/exercise-service";
import { FocusPauseService } from "./application/focus-pause-service";
import { LookAwayService } from "./application/look-away-service";
import type { NotificationGate } from "./application/ports/notification-gate";
import { PreferencesService } from "./application/preferences-service";
import { ReminderService } from "./application/reminder-service";
import { createFocusEnvironment } from "./infrastructure/focus/create-focus-environment";
import { FocusEnvironmentMonitor } from "./infrastructure/focus/focus-environment-monitor";
import { registerIpcHandlers } from "./infrastructure/ipc/register-ipc-handlers";
import { AppLifecycle } from "./infrastructure/lifecycle/app-lifecycle";
import { applyLaunchAtLogin } from "./infrastructure/lifecycle/login-item";
import { BlinkDetectorDebugLogger } from "./infrastructure/logging/blink-detector-debug-logger";
import { configureFileLogging } from "./infrastructure/logging/configure-file-logging";
import { configureAppPaths } from "./infrastructure/paths/app-paths";
import { ChildProcessRegistry } from "./infrastructure/process/child-process-registry";
import {
	killOrphanedSidecarProcesses,
	ProcessCleanup,
} from "./infrastructure/process/process-cleanup";
import { BlinkDetectorSidecar } from "./infrastructure/sidecar/blink-detector-sidecar";
import { ShortcutController } from "./infrastructure/shortcuts/shortcut-controller";
import { NotificationSoundPlayer } from "./infrastructure/sound/notification-sound-player";
import { ElectronPreferenceStore } from "./infrastructure/store/electron-preference-store";
import { TrayController } from "./infrastructure/tray/tray-controller";
import { WindowManager } from "./infrastructure/windows/window-manager";
import { IPC_CHANNELS } from "../shared/ipc-channels";

if (process.platform === "darwin") {
	process.env.NSWindowSupportsNonactivatingPanel = "true";
}

// Shared identity so packaged + `npm run dev` share one single-instance lock.
const APP_USER_MODEL_ID = "com.xpogx.blinkguard";
if (process.platform === "win32") {
	app.setAppUserModelId(APP_USER_MODEL_ID);
}
app.setPath("userData", path.join(app.getPath("appData"), "BlinkGuard"));

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
	// Hard exit: do not continue constructing services / spawning sidecars.
	app.exit(0);
} else {
	bootstrap();
}

function bootstrap(): void {
	configureFileLogging();

	const entryDirectory = path.dirname(fileURLToPath(import.meta.url));
	const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
	const paths = configureAppPaths(entryDirectory, VITE_DEV_SERVER_URL);

	const store = new ElectronPreferenceStore();
	const statsStore = new ElectronPreferenceStore({ name: "blinkguard-stats" });
	const preferencesService = new PreferencesService(store);
	const preferences = preferencesService.current;
	const blinkStats = new BlinkStatsService(statsStore);
	const state = new AppRuntimeState();
	const processes = new ChildProcessRegistry();
	const windows = new WindowManager(paths, preferences, VITE_DEV_SERVER_URL);
	const sound = new NotificationSoundPlayer(paths, preferences, app.isPackaged);

	blinkStats.setPushHandler((snapshot) => {
		windows.sendToMain(IPC_CHANNELS.loadBlinkStats, snapshot);
	});

	const gateHolder: { current: NotificationGate } = {
		current: {
			notificationsAllowed: () => true,
			pauseReason: () => null,
		},
	};
	const notificationGate: NotificationGate = {
		notificationsAllowed: () => gateHolder.current.notificationsAllowed(),
		pauseReason: () => gateHolder.current.pauseReason(),
	};

	let reminders: ReminderService;
	const blinkDebugLogger = new BlinkDetectorDebugLogger();
	const sidecar = new BlinkDetectorSidecar(
		paths,
		app.isPackaged,
		processes,
		preferences,
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
				preferences.isTracking &&
				preferences.cameraEnabled &&
				!reminders.isCameraSoftPaused,
			onCalibrationProgress: (payload) => {
				windows.sendToMain(IPC_CHANNELS.earCalibrationProgress, payload);
			},
			onCalibrationComplete: (payload) => {
				if (payload.baseline !== null) {
					preferencesService.set("earCalibration", payload.baseline);
					sidecar.applyEarCalibration(payload.baseline);
					windows.sendPreferences();
				}
				windows.sendToMain(IPC_CHANNELS.earCalibrationComplete, payload);
			},
		},
		blinkDebugLogger,
	);
	reminders = new ReminderService(
		preferences,
		state,
		windows,
		sidecar,
		sound,
		store,
		blinkStats,
		notificationGate,
	);
	const focusEnvironment = createFocusEnvironment();
	const focusPause = new FocusPauseService(
		preferences,
		windows,
		reminders,
		IPC_CHANNELS.focusPauseState,
	);
	gateHolder.current = focusPause;
	const focusMonitor = new FocusEnvironmentMonitor(
		focusEnvironment,
		(isFullscreen) => {
			focusPause.setFullscreen(isFullscreen);
		},
	);

	const exercises = new ExerciseService(
		preferences,
		state,
		store,
		windows,
		sound,
		notificationGate,
	);
	const lookAway = new LookAwayService(
		preferences,
		state,
		store,
		windows,
		sound,
		notificationGate,
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
		lookAway,
		windows,
		new ProcessCleanup(processes),
		blinkStats,
		() => {
			focusMonitor.stop();
			focusPause.stopQuietHoursWatch();
			focusEnvironment.dispose?.();
		},
	);
	const tray = new TrayController(paths, windows, () => lifecycle.quit());
	lifecycle.attachTray(tray);

	registerIpcHandlers({
		preferences: preferencesService,
		reminders,
		exercises,
		lookAway,
		sidecar,
		shortcuts,
		windows,
		blinkStats,
		focusPause,
	});

	app.on("second-instance", () => {
		windows.showMain();
	});

	app.on("activate", () => windows.activateMain(lifecycle.handleMainClose));

	void app.whenReady().then(async () => {
		lifecycle.register();
		windows.createMain(lifecycle.handleMainClose);

		const startHidden =
			process.argv.includes("--hidden") ||
			app.getLoginItemSettings().wasOpenedAtLogin;
		if (startHidden) {
			windows.main?.hide();
		}

		tray.create();
		applyLaunchAtLogin(preferences.launchAtLogin);
		shortcuts.register(preferences.keyboardShortcut);

		preferences.popupPosition = store.has("popupPosition")
			? store.get("popupPosition")
			: null;

		exercises.resetTimer();
		if (preferences.eyeExercisesEnabled) exercises.start();

		lookAway.resetTimer();
		if (preferences.lookAwayEnabled) lookAway.start();

		focusPause.startQuietHoursWatch();
		focusMonitor.start();
		windows.setOnMainLoaded(() => {
			focusPause.pushState();
		});

		blinkDebugLogger.announce();
		blinkDebugLogger.append({
			source: "main",
			type: "startup",
			message: "Blink detector debug logging ready",
		});
		// Drop orphans left by HMR / crash before spawning a fresh sidecar.
		await killOrphanedSidecarProcesses();
		console.log("Starting blink detector on app startup...");
		sidecar.start();

		if (preferences.isTracking) {
			reminders.start(preferences.reminderInterval);
		}
	});
}
