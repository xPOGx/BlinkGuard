import type { AppPreferences } from "../../shared/preferences";
import {
	isInQuietHours,
	resolveFocusPauseReason,
	type FocusPauseReason,
} from "../domain/focus-policy";
import type { NotificationGate } from "./ports/notification-gate";
import type { ReminderService } from "./reminder-service";

export interface FocusPauseWindowsPort {
	closeReminder(): void;
	closeExercise(): void;
	closeLookAway(): void;
	hideNoFace(): void;
	sendToMain(channel: string, ...args: unknown[]): void;
}

export class FocusPauseService implements NotificationGate {
	private reason: FocusPauseReason = null;
	private cameraPausedForFullscreen = false;
	private isFullscreen = false;
	private quietHoursTimer: ReturnType<typeof setInterval> | null = null;

	constructor(
		private readonly preferences: AppPreferences,
		private readonly windows: FocusPauseWindowsPort,
		private readonly reminders: ReminderService,
		private readonly focusPauseChannel: string,
	) {}

	notificationsAllowed(): boolean {
		return this.reason === null;
	}

	pauseReason(): FocusPauseReason {
		return this.reason;
	}

	setFullscreen(isFullscreen: boolean): void {
		this.isFullscreen = isFullscreen;
		this.recompute();
	}

	/** Re-evaluate quiet hours / fullscreen and apply side effects. */
	recompute(): void {
		const next = resolveFocusPauseReason({
			quietHoursEnabled: this.preferences.quietHoursEnabled,
			inQuietHours: isInQuietHours(
				new Date(),
				this.preferences.quietHoursStart,
				this.preferences.quietHoursEnd,
			),
			pauseOnFullscreen: this.preferences.pauseOnFullscreen,
			isFullscreen: this.isFullscreen,
		});

		if (next !== null && this.reason === null) {
			this.closeInterruptiveUi();
		}

		const fullscreenActive =
			this.preferences.pauseOnFullscreen && this.isFullscreen;
		if (fullscreenActive && !this.cameraPausedForFullscreen) {
			this.pauseCameraForFullscreen();
		} else if (!fullscreenActive && this.cameraPausedForFullscreen) {
			this.resumeCameraAfterFullscreen();
		}

		const changed = next !== this.reason;
		this.reason = next;
		if (changed) {
			this.pushState();
		}
	}

	startQuietHoursWatch(intervalMs = 30_000): void {
		if (this.quietHoursTimer) return;
		this.recompute();
		this.pushState();
		this.quietHoursTimer = setInterval(() => this.recompute(), intervalMs);
	}

	stopQuietHoursWatch(): void {
		if (this.quietHoursTimer) clearInterval(this.quietHoursTimer);
		this.quietHoursTimer = null;
	}

	pushState(): void {
		this.windows.sendToMain(this.focusPauseChannel, {
			reason: this.reason,
		});
	}

	private closeInterruptiveUi(): void {
		this.windows.closeReminder();
		this.windows.closeExercise();
		this.windows.closeLookAway();
		this.windows.hideNoFace();
	}

	private pauseCameraForFullscreen(): void {
		if (!this.preferences.isTracking || !this.preferences.cameraEnabled) {
			return;
		}
		this.reminders.pauseCameraForFocus();
		this.cameraPausedForFullscreen = true;
	}

	private resumeCameraAfterFullscreen(): void {
		this.cameraPausedForFullscreen = false;
		this.reminders.resumeCameraIfNeeded();
	}
}
