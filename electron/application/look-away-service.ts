import type { AppPreferences } from "../../shared/preferences";
import type { AppRuntimeState } from "./app-runtime-state";
import type { PreferenceStore } from "./ports/preference-store";
import type { NotificationGate } from "./ports/notification-gate";
import type {
	LookAwayWindowPort,
	NotificationSoundPort,
} from "./ports/runtime-ports";

const ALLOW_ALL_GATE: NotificationGate = {
	notificationsAllowed: () => true,
	pauseReason: () => null,
};

export class LookAwayService {
	constructor(
		private readonly preferences: AppPreferences,
		private readonly state: AppRuntimeState,
		private readonly store: PreferenceStore,
		private readonly windows: LookAwayWindowPort,
		private readonly sound: NotificationSoundPort,
		private readonly notificationGate: NotificationGate = ALLOW_ALL_GATE,
	) {}

	start(): void {
		if (this.state.lookAwayInterval) clearInterval(this.state.lookAwayInterval);
		this.state.lookAwayInterval = setInterval(() => {
			const now = Date.now();
			const elapsed = now - this.store.get("lastLookAwayTime", 0);
			if (
				this.preferences.lookAwayEnabled &&
				!this.state.isLookAwayShowing &&
				elapsed >= this.preferences.lookAwayInterval * 60 * 1000
			) {
				this.show();
			}
		}, 60 * 1000);
	}

	stop(): void {
		this.state.clearLookAwayTimers();
		this.windows.closeLookAway();
	}

	skip(): void {
		this.closePopup();
		this.store.set("lastLookAwayTime", Date.now());
	}

	snooze(): void {
		this.closePopup();
		// Defer the regular cadence so the 60s tick does not race the snooze.
		this.store.set("lastLookAwayTime", Date.now());
		if (this.state.lookAwaySnoozeTimeout) {
			clearTimeout(this.state.lookAwaySnoozeTimeout);
		}
		this.state.lookAwaySnoozeTimeout = setTimeout(
			() => this.show(),
			5 * 60 * 1000,
		);
	}

	resetTimer(): void {
		this.store.set("lastLookAwayTime", Date.now());
	}

	private show(): void {
		if (this.state.isLookAwayShowing) return;
		if (!this.notificationGate.notificationsAllowed()) return;
		this.sound.play("exercise");
		this.state.isLookAwayShowing = true;
		this.store.set("lastLookAwayTime", Date.now());
		const popup = this.windows.showLookAway(() => {
			this.state.isLookAwayShowing = false;
		});
		if (!popup) {
			this.state.isLookAwayShowing = false;
			return;
		}
		const durationMs = Math.max(1, this.preferences.lookAwayDuration) * 1000;
		setTimeout(() => {
			if (this.windows.closeLookAwayIfCurrent(popup)) {
				this.state.isLookAwayShowing = false;
			}
		}, durationMs);
	}

	private closePopup(): void {
		this.windows.closeLookAway();
		this.state.isLookAwayShowing = false;
	}
}
