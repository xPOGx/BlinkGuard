import { app, powerMonitor } from "electron";
import type { AppRuntimeState } from "../../application/app-runtime-state";
import type { BlinkStatsService } from "../../application/blink-stats-service";
import type { ExerciseService } from "../../application/exercise-service";
import type { LookAwayService } from "../../application/look-away-service";
import type { ReminderService } from "../../application/reminder-service";
import type { AppPreferences } from "../../../shared/preferences";
import type { ProcessCleanup } from "../process/process-cleanup";
import type { WindowManager } from "../windows/window-manager";

export class AppLifecycle {
	private isQuitting = false;
	private shutdownComplete = false;
	private trayDestroy: (() => void) | null = null;

	constructor(
		private readonly preferences: AppPreferences,
		private readonly state: AppRuntimeState,
		private readonly reminders: ReminderService,
		private readonly exercises: ExerciseService,
		private readonly lookAway: LookAwayService,
		private readonly windows: WindowManager,
		private readonly cleanup: ProcessCleanup,
		private readonly blinkStats: BlinkStatsService,
		private readonly onShutdown?: () => void,
	) {}

	attachTray(tray: { destroy(): void }): void {
		this.trayDestroy = () => tray.destroy();
	}

	register(): void {
		// Tray app: subscribe so Electron does not quit when the last window
		// is destroyed (Windows default). Sidecar `_MEI*` cleanup needs that.
		app.on("window-all-closed", () => {
			if (this.shutdownComplete) return;
		});
		app.on("before-quit", (event) => {
			if (this.shutdownComplete) return;
			event.preventDefault();
			void this.shutdown().then(() => app.quit());
		});
		powerMonitor.on("suspend", () => {
			this.state.wasTrackingBeforeSleep = this.preferences.isTracking;
			this.state.wasCameraEnabledBeforeSleep = this.preferences.cameraEnabled;
			if (this.preferences.isTracking) this.reminders.ensureStopped();
		});
		powerMonitor.on("resume", () => {
			this.exercises.resetTimer();
			this.lookAway.resetTimer();
			if (this.state.wasTrackingBeforeSleep) {
				this.reminders.resumeAfterSleep(
					this.state.wasCameraEnabledBeforeSleep,
				);
			}
		});
		this.registerProcessSignals();
	}

	/** Close button hides the main window; process stays alive (tray / Quit to exit). */
	handleMainClose = (event: Electron.Event): void => {
		if (this.isQuitting) return;
		event.preventDefault();
		this.windows.main?.hide();
	};

	/** Explicit quit from tray / OS — runs graceful shutdown then exits. */
	quit(): void {
		if (this.isQuitting) return;
		void this.shutdown().then(() => app.quit());
	}

	async shutdown(): Promise<void> {
		if (this.isQuitting) return;
		this.isQuitting = true;
		this.trayDestroy?.();
		this.trayDestroy = null;
		this.onShutdown?.();
		this.blinkStats.dispose();
		this.state.clearReminderTimers();
		this.state.clearExerciseTimers();
		this.state.clearLookAwayTimers();
		// Sidecar first: destroying windows on Windows can start app.quit()
		// and TerminateProcess the PyInstaller bootloader before `_MEI*` delete.
		await this.cleanup.run();
		this.windows.destroyAll();
		this.shutdownComplete = true;
	}

	private registerProcessSignals(): void {
		for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"] as const) {
			process.on(signal, () => {
				if (!this.isQuitting) {
					void this.shutdown().then(() => process.exit(0));
				}
			});
		}
		process.on("uncaughtException", (error) => {
			console.error("Uncaught exception:", error);
			if (!this.isQuitting) void this.shutdown().then(() => process.exit(1));
		});
		process.on("unhandledRejection", (reason, promise) => {
			console.error("Unhandled Rejection at:", promise, "reason:", reason);
			if (!this.isQuitting) void this.shutdown().then(() => process.exit(1));
		});
	}
}
