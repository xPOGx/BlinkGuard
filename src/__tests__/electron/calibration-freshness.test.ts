import { describe, expect, it } from "vitest";
import type { CalibrationNudgeToastInput } from "../../../electron/domain/calibration-freshness";
import {
	activeCalibrationNudgeReason,
	CALIBRATION_NUDGE_COOLDOWN_MS,
	CALIBRATION_STALE_AFTER_MS,
	isCalibrationStale,
	sanitizeCalibrationNudgePayload,
	shouldShowCalibrationNudgeToast,
} from "../../../electron/domain/calibration-freshness";

const NOW = 1_700_000_000_000;

function toast(
	overrides: Partial<CalibrationNudgeToastInput> = {},
): CalibrationNudgeToastInput {
	return {
		enabled: true,
		cameraEnabled: true,
		isTracking: true,
		reason: "stale",
		lastShownAt: 0,
		now: NOW,
		notificationsAllowed: true,
		hasBlockingToast: false,
		...overrides,
	};
}

describe("isCalibrationStale", () => {
	it("is not stale when there is no saved EAR", () => {
		expect(
			isCalibrationStale({
				earCalibration: null,
				calibrationAt: null,
				now: NOW,
			}),
		).toBe(false);
	});

	it("treats a saved EAR without a timestamp as stale", () => {
		expect(
			isCalibrationStale({
				earCalibration: 0.28,
				calibrationAt: null,
				now: NOW,
			}),
		).toBe(true);
	});

	it("is stale after 30 days and fresh before that", () => {
		expect(
			isCalibrationStale({
				earCalibration: 0.28,
				calibrationAt: NOW - CALIBRATION_STALE_AFTER_MS,
				now: NOW,
			}),
		).toBe(true);
		expect(
			isCalibrationStale({
				earCalibration: 0.28,
				calibrationAt: NOW - CALIBRATION_STALE_AFTER_MS + 1,
				now: NOW,
			}),
		).toBe(false);
	});
});

describe("activeCalibrationNudgeReason", () => {
	it("returns null when there is no EAR baseline", () => {
		expect(
			activeCalibrationNudgeReason({
				earCalibration: null,
				calibrationAt: null,
				dismissedAt: null,
				driftAt: NOW,
				now: NOW,
			}),
		).toBeNull();
	});

	it("prefers drift over stale when drift is newer than dismiss", () => {
		expect(
			activeCalibrationNudgeReason({
				earCalibration: 0.28,
				calibrationAt: NOW - CALIBRATION_STALE_AFTER_MS,
				dismissedAt: NOW - 10,
				driftAt: NOW,
				now: NOW,
			}),
		).toBe("drift");
	});

	it("snoozes stale after dismiss until a newer calibration stamp", () => {
		expect(
			activeCalibrationNudgeReason({
				earCalibration: 0.28,
				calibrationAt: null,
				dismissedAt: NOW,
				driftAt: null,
				now: NOW,
			}),
		).toBeNull();
		expect(
			activeCalibrationNudgeReason({
				earCalibration: 0.28,
				calibrationAt: NOW - CALIBRATION_STALE_AFTER_MS,
				dismissedAt: NOW,
				driftAt: null,
				now: NOW,
			}),
		).toBeNull();
	});

	it("re-arms stale after a newer successful calibration goes stale again", () => {
		const calibratedAt = NOW - CALIBRATION_STALE_AFTER_MS;
		expect(
			activeCalibrationNudgeReason({
				earCalibration: 0.28,
				calibrationAt: calibratedAt,
				dismissedAt: calibratedAt - 1,
				driftAt: null,
				now: NOW,
			}),
		).toBe("stale");
	});
});

describe("shouldShowCalibrationNudgeToast", () => {
	it("shows when tracking with a reason and an open gate", () => {
		expect(shouldShowCalibrationNudgeToast(toast())).toBe(true);
	});

	it("respects opt-out, tracking, gate, and blocking toasts", () => {
		expect(shouldShowCalibrationNudgeToast(toast({ enabled: false }))).toBe(
			false,
		);
		expect(
			shouldShowCalibrationNudgeToast(toast({ cameraEnabled: false })),
		).toBe(false);
		expect(shouldShowCalibrationNudgeToast(toast({ isTracking: false }))).toBe(
			false,
		);
		expect(
			shouldShowCalibrationNudgeToast(toast({ notificationsAllowed: false })),
		).toBe(false);
		expect(
			shouldShowCalibrationNudgeToast(toast({ hasBlockingToast: true })),
		).toBe(false);
		expect(shouldShowCalibrationNudgeToast(toast({ reason: null }))).toBe(
			false,
		);
	});

	it("respects the 24h cooldown", () => {
		expect(
			shouldShowCalibrationNudgeToast(
				toast({
					lastShownAt: NOW - CALIBRATION_NUDGE_COOLDOWN_MS + 1,
				}),
			),
		).toBe(false);
		expect(
			shouldShowCalibrationNudgeToast(
				toast({
					lastShownAt: NOW - CALIBRATION_NUDGE_COOLDOWN_MS,
				}),
			),
		).toBe(true);
	});
});

describe("sanitizeCalibrationNudgePayload", () => {
	it("accepts stale or drift and rejects anything else", () => {
		expect(sanitizeCalibrationNudgePayload({ reason: "stale" })).toEqual({
			reason: "stale",
		});
		expect(sanitizeCalibrationNudgePayload({ reason: "drift" })).toEqual({
			reason: "drift",
		});
		expect(sanitizeCalibrationNudgePayload({ reason: "nope" })).toEqual({
			reason: null,
		});
		expect(sanitizeCalibrationNudgePayload(null)).toEqual({ reason: null });
	});
});
