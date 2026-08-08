import { globalShortcut } from "electron";
import type { AppPreferences } from "../../../shared/preferences";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import type { AppRuntimeState } from "../../application/app-runtime-state";
import type { ReminderService } from "../../application/reminder-service";
import type { InteractionLogger } from "../logging/interaction-logger";
import type { WindowManager } from "../windows/window-manager";

export class ShortcutController {
	constructor(
		private readonly preferences: AppPreferences,
		private readonly state: AppRuntimeState,
		private readonly reminders: ReminderService,
		private readonly windows: WindowManager,
		private readonly interactions: InteractionLogger | null = null,
	) {}

	register(shortcut: string): void {
		globalShortcut.unregisterAll();
		try {
			const registered = globalShortcut.register(shortcut, () => {
				if (this.state.isAutoResuming) {
					this.state.isAutoResuming = false;
					this.reminders.ensureStopped();
				}
				const wasTracking = this.preferences.isTracking;
				if (wasTracking) {
					this.reminders.stop(true);
				} else {
					this.reminders.start();
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
