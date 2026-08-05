import { app, powerMonitor } from "electron";
import type { AppRuntimeState } from "../../application/app-runtime-state";
import type { ExerciseService } from "../../application/exercise-service";
import type { ReminderService } from "../../application/reminder-service";
import type { AppPreferences } from "../../../shared/preferences";
import type { ProcessCleanup } from "../process/process-cleanup";
import type { WindowManager } from "../windows/window-manager";

export class AppLifecycle {
	private isQuitting = false;

	constructor(
		private readonly preferences: AppPreferences,
		private readonly state: AppRuntimeState,
		private readonly reminders: ReminderService,
		private readonly exercises: ExerciseService,
		private readonly windows: WindowManager,
		private readonly cleanup: ProcessCleanup,
	) {}

	register(): void {
		app.on("before-quit", (event) => {
			if (this.isQuitting) return;
			event.preventDefault();
			void this.shutdown().then(() => app.quit());
		});
		if (process.platform === "win32") {
			app.on("window-all-closed", () => {
				if (!this.isQuitting) void this.shutdown().then(() => app.quit());
			});
		}
		powerMonitor.on("suspend", () => {
			this.state.wasTrackingBeforeSleep = this.preferences.isTracking;
			this.state.wasCameraEnabledBeforeSleep = this.preferences.cameraEnabled;
			if (this.preferences.isTracking) this.reminders.ensureStopped();
		});
		powerMonitor.on("resume", () => {
			this.exercises.resetTimer();
			if (this.state.wasTrackingBeforeSleep) {
				this.reminders.resumeAfterSleep(
					this.state.wasCameraEnabledBeforeSleep,
				);
			}
		});
		this.registerProcessSignals();
	}

	handleMainClose = (event: Electron.Event): void => {
		if (process.platform === "darwin") {
			event.preventDefault();
			this.windows.main?.hide();
			return;
		}
		event.preventDefault();
		const timeout = setTimeout(() => process.exit(0), 5000);
		void this.shutdown()
			.then(() => {
				clearTimeout(timeout);
				app.quit();
			})
			.catch((error) => {
				console.error("Error during graceful shutdown:", error);
				clearTimeout(timeout);
				process.exit(1);
			});
	};

	async shutdown(): Promise<void> {
		if (this.isQuitting) return;
		this.isQuitting = true;
		this.state.clearReminderTimers();
		this.state.clearExerciseTimers();
		this.windows.destroyAll();
		await this.cleanup.run();
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
