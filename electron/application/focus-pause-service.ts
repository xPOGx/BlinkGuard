import type { AppPreferences, PauseAppRule } from "../../shared/preferences";
import {
	foregroundMatchesAppRules,
	isInQuietHours,
	resolveFocusPauseReason,
	type FocusPauseReason,
} from "../domain/focus-policy";
import type { NotificationGate } from "./ports/notification-gate";
import type { FocusForegroundSnapshot } from "./ports/focus-environment-port";
import { EMPTY_FOREGROUND_SNAPSHOT } from "./ports/focus-environment-port";
import type { ReminderService } from "./reminder-service";

export interface FocusPauseWindowsPort {
	closeReminder(): void;
	closeExercise(): void;
	closeLookAway(): void;
	hideNoFace(): void;
	hideBlinkRateCoach(): void;
	sendToMain(channel: string, ...args: unknown[]): void;
}

export interface FocusPauseStatePayload {
	reason: FocusPauseReason;
	fullscreenDetectionSupported: boolean;
}

export class FocusPauseService implements NotificationGate {
	private reason: FocusPauseReason = null;
	private cameraPausedForFocus = false;
	private foreground: FocusForegroundSnapshot = EMPTY_FOREGROUND_SNAPSHOT;
	private lastExternal: PauseAppRule | null = null;
	private quietHoursTimer: ReturnType<typeof setInterval> | null = null;

	constructor(
		private readonly preferences: AppPreferences,
		private readonly windows: FocusPauseWindowsPort,
		private readonly reminders: ReminderService,
		private readonly focusPauseChannel: string,
		private readonly fullscreenDetectionSupported: boolean,
	) {}

	notificationsAllowed(): boolean {
		return this.reason === null;
	}

	pauseReason(): FocusPauseReason {
		return this.reason;
	}

	setForeground(snapshot: FocusForegroundSnapshot): void {
		this.foreground = snapshot;
		const processName = snapshot.processName?.trim() ?? "";
		if (processName) {
			this.lastExternal = { processName, windowTitle: "" };
		} else {
			const windowTitle = snapshot.windowTitle?.trim() ?? "";
			if (windowTitle) {
				this.lastExternal = { processName: "", windowTitle };
			}
		}
		this.recompute();
	}

	/** Last non-empty foreground identity; survives BlinkGuard-focused empty probes. */
	lastExternalForeground(): PauseAppRule | null {
		return this.lastExternal ? { ...this.lastExternal } : null;
	}

	setFullscreen(isFullscreen: boolean): void {
		this.setForeground({ ...this.foreground, isFullscreen });
	}

	/** Re-evaluate quiet hours / fullscreen / app rules and apply side effects. */
	recompute(): void {
		const appRuleMatched = foregroundMatchesAppRules(
			this.preferences.pauseAppRules,
			{
				processName: this.foreground.processName ?? "",
				windowTitle: this.foreground.windowTitle ?? "",
			},
		);
		const next = resolveFocusPauseReason({
			quietHoursEnabled: this.preferences.quietHoursEnabled,
			inQuietHours: isInQuietHours(
				new Date(),
				this.preferences.quietHoursStart,
				this.preferences.quietHoursEnd,
			),
			pauseOnFullscreen: this.preferences.pauseOnFullscreen,
			isFullscreen: this.foreground.isFullscreen,
			appRuleMatched,
		});

		if (next !== null && this.reason === null) {
			this.closeInterruptiveUi();
		}

		const cameraShouldPause =
			(this.preferences.pauseOnFullscreen && this.foreground.isFullscreen) ||
			appRuleMatched;
		if (cameraShouldPause && !this.cameraPausedForFocus) {
			this.pauseCameraForFocus();
		} else if (!cameraShouldPause && this.cameraPausedForFocus) {
			this.resumeCameraAfterFocus();
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
		const payload: FocusPauseStatePayload = {
			reason: this.reason,
			fullscreenDetectionSupported: this.fullscreenDetectionSupported,
		};
		this.windows.sendToMain(this.focusPauseChannel, payload);
	}

	private closeInterruptiveUi(): void {
		this.windows.closeReminder();
		this.windows.closeExercise();
		this.windows.closeLookAway();
		this.windows.hideNoFace();
		this.windows.hideBlinkRateCoach();
	}

	private pauseCameraForFocus(): void {
		if (!this.preferences.isTracking || !this.preferences.cameraEnabled) {
			return;
		}
		this.reminders.pauseCameraForFocus();
		this.cameraPausedForFocus = true;
	}

	private resumeCameraAfterFocus(): void {
		this.cameraPausedForFocus = false;
		this.reminders.resumeCameraIfNeeded();
	}
}
