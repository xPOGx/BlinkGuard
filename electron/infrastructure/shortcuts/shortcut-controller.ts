import { globalShortcut } from "electron";
import type { AppPreferences } from "../../../shared/preferences";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import type { AppRuntimeState } from "../../application/app-runtime-state";
import type { ExerciseService } from "../../application/exercise-service";
import type { LookAwayService } from "../../application/look-away-service";
import type { ReminderService } from "../../application/reminder-service";
import {
	startTrackingSession,
	stopTrackingSession,
} from "../../application/tracking-session";
import type { InteractionLogger } from "../logging/interaction-logger";
import type { WindowManager } from "../windows/window-manager";

export class ShortcutController {
	constructor(
		private readonly preferences: AppPreferences,
		private readonly state: AppRuntimeState,
		private readonly reminders: ReminderService,
		private readonly exercises: ExerciseService,
		private readonly lookAway: LookAwayService,
		private readonly windows: WindowManager,
		private readonly interactions: InteractionLogger | null = null,
	) {}

	private sessionDeps() {
		return {
			reminders: this.reminders,
			exercises: this.exercises,
			lookAway: this.lookAway,
			preferences: this.preferences,
		};
	}

	register(shortcut: string): void {
		globalShortcut.unregisterAll();
		try {
			const registered = globalShortcut.register(shortcut, () => {
				if (this.state.isAutoResuming) {
					this.state.isAutoResuming = false;
					stopTrackingSession(this.sessionDeps(), false);
				}
				const wasTracking = this.preferences.isTracking;
				if (wasTracking) {
					stopTrackingSession(this.sessionDeps(), true);
				} else {
					startTrackingSession(this.sessionDeps());
				}
				this.interactions?.append({
					source: "shortcut",
					action: "toggle-tracking",
					detail: {
						shortcut,
						wasTracking,
						isTracking: this.preferences.isTracking,
					},
				});
				this.windows.sendPreferences();
			});
			this.windows.sendToMain(
				IPC_CHANNELS.shortcutError,
				registered ? null : shortcut,
			);
		} catch (error) {
			console.error("Error registering global shortcut:", shortcut, error);
			this.windows.sendToMain(IPC_CHANNELS.shortcutError, shortcut);
		}
	}
}
