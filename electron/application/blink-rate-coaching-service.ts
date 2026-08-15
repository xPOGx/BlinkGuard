import type { AppPreferences } from "../../shared/preferences";
import { shouldShowBlinkRateCoach } from "../domain/blink-rate-coaching";
import type { NotificationGate } from "./ports/notification-gate";
import type { BlinkRateCoachWindowPort } from "./ports/runtime-ports";

const COACH_EVALUATE_MS = 15_000;

const ALLOW_ALL_GATE: NotificationGate = {
	notificationsAllowed: () => true,
	pauseReason: () => null,
};

export type LiveBlinkRateSource = {
	getSnapshot(now?: Date): {
		blinksPerMinute: number;
		blinkRateReady: boolean;
	};
};

/**
 * Soft toast when live camera BPM stays below the user threshold.
 * Reads BPM from BlinkStatsService — does not own blink timestamps.
 */
export class BlinkRateCoachingService {
	private evaluateTimer: ReturnType<typeof setInterval> | null = null;
	private lastShownAt = 0;
	private active = false;

	constructor(
		private readonly preferences: AppPreferences,
		private readonly stats: LiveBlinkRateSource,
		private readonly windows: BlinkRateCoachWindowPort,
		private readonly notificationGate: NotificationGate = ALLOW_ALL_GATE,
	) {}

	/** Start periodic evaluate while camera tracking is active. */
	start(): void {
		if (!this.preferences.cameraEnabled || !this.preferences.isTracking) {
			this.stop();
			return;
		}
		if (this.active) return;
		this.active = true;
		this.evaluateTimer = setInterval(() => this.evaluate(), COACH_EVALUATE_MS);
		this.evaluate();
	}

	stop(): void {
		this.active = false;
		if (this.evaluateTimer) {
			clearInterval(this.evaluateTimer);
			this.evaluateTimer = null;
		}
		this.windows.hideBlinkRateCoach();
	}

	dispose(): void {
		this.stop();
	}

	evaluate(nowMs: number = Date.now()): void {
		if (!this.active) return;
		const snapshot = this.stats.getSnapshot(new Date(nowMs));
		const show = shouldShowBlinkRateCoach({
			enabled: this.preferences.blinkRateCoachingEnabled,
			cameraEnabled: this.preferences.cameraEnabled,
			isTracking: this.preferences.isTracking,
			blinkRateReady: snapshot.blinkRateReady,
			blinksPerMinute: snapshot.blinksPerMinute,
			thresholdPerMin: this.preferences.blinkRateThresholdPerMin,
			lastShownAt: this.lastShownAt,
			now: nowMs,
			notificationsAllowed: this.notificationGate.notificationsAllowed(),
			hasBlockingToast:
				this.windows.hasReminder() ||
				this.windows.hasNoFace() ||
				this.windows.hasBlinkRateCoach() ||
				this.windows.hasCalibrationNudge(),
		});
		if (!show) return;
		this.windows.showBlinkRateCoach();
		this.lastShownAt = nowMs;
	}
}
