/** Soft EAR calibration freshness / drift nudge (Electron-free policy). */

export const CALIBRATION_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
/** Minimum gap between gated tracking toasts (stale or drift). */
export const CALIBRATION_NUDGE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type CalibrationNudgeReason = "stale" | "drift";

export type CalibrationNudgePayload = {
	reason: CalibrationNudgeReason | null;
};

export type CalibrationStaleInput = {
	earCalibration: number | null;
	calibrationAt: number | null;
	now: number;
	staleAfterMs?: number;
};

export type CalibrationNudgeReasonInput = CalibrationStaleInput & {
	dismissedAt: number | null;
	driftAt: number | null;
};

export type CalibrationNudgeToastInput = {
	enabled: boolean;
	cameraEnabled: boolean;
	isTracking: boolean;
	reason: CalibrationNudgeReason | null;
	lastShownAt: number;
	now: number;
	notificationsAllowed: boolean;
	hasBlockingToast: boolean;
	cooldownMs?: number;
};

/** True when a saved EAR baseline is missing a stamp or older than the stale window. */
export function isCalibrationStale(input: CalibrationStaleInput): boolean {
	if (input.earCalibration == null) return false;
	if (input.calibrationAt == null) return true;
	const staleAfter = input.staleAfterMs ?? CALIBRATION_STALE_AFTER_MS;
	return input.now - input.calibrationAt >= staleAfter;
}

/**
 * Banner/toast reason: drift wins over stale. Dismiss snoozes stale until a
 * newer calibration stamp; a later driftAt re-arms.
 */
export function activeCalibrationNudgeReason(
	input: CalibrationNudgeReasonInput,
): CalibrationNudgeReason | null {
	if (input.earCalibration == null) return null;
	const driftAt = input.driftAt;
	const dismissedAt = input.dismissedAt;
	const pendingDrift =
		typeof driftAt === "number" && Number.isFinite(driftAt) && driftAt > 0;
	if (pendingDrift && (dismissedAt == null || driftAt > dismissedAt)) {
		return "drift";
	}
	if (!isCalibrationStale(input)) return null;
	const snoozed =
		dismissedAt != null &&
		(input.calibrationAt == null || dismissedAt >= input.calibrationAt);
	if (snoozed) return null;
	return "stale";
}

/** Gated click-through toast — never auto-starts calibration. */
export function shouldShowCalibrationNudgeToast(
	input: CalibrationNudgeToastInput,
): boolean {
	if (!input.enabled) return false;
	if (!input.cameraEnabled || !input.isTracking) return false;
	if (!input.reason) return false;
	if (!input.notificationsAllowed) return false;
	if (input.hasBlockingToast) return false;
	const cooldown = input.cooldownMs ?? CALIBRATION_NUDGE_COOLDOWN_MS;
	if (input.lastShownAt > 0 && input.now - input.lastShownAt < cooldown) {
		return false;
	}
	return true;
}

export function sanitizeCalibrationNudgePayload(
	input: unknown,
): CalibrationNudgePayload {
	if (!input || typeof input !== "object") return { reason: null };
	const reason = (input as Record<string, unknown>).reason;
	if (reason === "stale" || reason === "drift") return { reason };
	return { reason: null };
}
