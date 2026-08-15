import { IPC_CHANNELS } from "../../shared/ipc-channels";
import {
	activeCalibrationNudgeReason,
	shouldShowCalibrationNudgeToast,
	type CalibrationNudgePayload,
	type CalibrationNudgeReason,
} from "../domain/calibration-freshness";
import type { NotificationGate } from "./ports/notification-gate";
import type { CalibrationNudgeWindowPort } from "./ports/runtime-ports";
import type { PreferencesService } from "./preferences-service";

const ALLOW_ALL_GATE: NotificationGate = {
	notificationsAllowed: () => true,
	pauseReason: () => null,
};

/**
 * Soft toast + settings banner when EAR calibration is stale or the sidecar
 * reports baseline drift. Never auto-starts a calibration session.
 */
export class CalibrationNudgeService {
	private lastShownAt = 0;
	private active = false;

	constructor(
		private readonly preferences: PreferencesService,
		private readonly windows: CalibrationNudgeWindowPort,
		private readonly notificationGate: NotificationGate = ALLOW_ALL_GATE,
	) {}

	start(): void {
		const prefs = this.preferences.current;
		if (!prefs.cameraEnabled || !prefs.isTracking) {
			this.stop();
			return;
		}
		this.active = true;
		this.evaluate();
	}

	stop(): void {
		this.active = false;
		this.windows.hideCalibrationNudge();
	}

	dispose(): void {
		this.stop();
	}

	/** Sidecar session drift — persist the stamp, do not write the nudged EAR. */
	onDriftNudge(nowMs: number = Date.now()): void {
		this.preferences.set("lastBaselineDriftAt", nowMs);
		this.evaluate(nowMs);
	}

	/** Successful calibrate or reset — clear snooze + drift and hide the toast. */
	onCalibrationUpdated(nowMs: number = Date.now()): void {
		this.preferences.set("lastBaselineDriftAt", null);
		this.preferences.set("calibrationNudgeDismissedAt", null);
		this.windows.hideCalibrationNudge();
		this.pushReason(this.currentReason(nowMs));
	}

	dismiss(nowMs: number = Date.now()): void {
		this.preferences.set("calibrationNudgeDismissedAt", nowMs);
		this.windows.hideCalibrationNudge();
		this.lastShownAt = nowMs;
		this.pushReason(this.currentReason(nowMs));
	}

	evaluate(nowMs: number = Date.now()): void {
		const reason = this.currentReason(nowMs);
		this.pushReason(reason);
		if (!this.active) return;
		const prefs = this.preferences.current;
		const show = shouldShowCalibrationNudgeToast({
			enabled: prefs.calibrationNudgeEnabled,
			cameraEnabled: prefs.cameraEnabled,
			isTracking: prefs.isTracking,
			reason,
			lastShownAt: this.lastShownAt,
			now: nowMs,
			notificationsAllowed: this.notificationGate.notificationsAllowed(),
			hasBlockingToast:
				this.windows.hasReminder() ||
				this.windows.hasNoFace() ||
				this.windows.hasBlinkRateCoach() ||
				this.windows.hasCalibrationNudge(),
		});
		if (!show || !reason) return;
		this.windows.showCalibrationNudge(reason);
		this.lastShownAt = nowMs;
	}

	currentReason(nowMs: number = Date.now()): CalibrationNudgeReason | null {
		const prefs = this.preferences.current;
		return activeCalibrationNudgeReason({
			earCalibration: prefs.earCalibration,
			calibrationAt: prefs.calibrationAt,
			dismissedAt: prefs.calibrationNudgeDismissedAt,
			driftAt: prefs.lastBaselineDriftAt,
			now: nowMs,
		});
	}

	private pushReason(reason: CalibrationNudgeReason | null): void {
		const payload: CalibrationNudgePayload = { reason };
		this.windows.sendToMain(IPC_CHANNELS.calibrationNudge, payload);
	}
}
