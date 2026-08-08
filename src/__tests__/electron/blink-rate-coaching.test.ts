import { describe, expect, it } from "vitest";
import {
	BLINK_RATE_COACH_COOLDOWN_MS,
	type BlinkRateCoachInput,
	shouldShowBlinkRateCoach,
} from "../../../electron/domain/blink-rate-coaching";
import { BLINK_RATE_LOW_MAX } from "../../../shared/blink-rate";

function base(
	overrides: Partial<BlinkRateCoachInput> = {},
): BlinkRateCoachInput {
	return {
		enabled: true,
		cameraEnabled: true,
		isTracking: true,
		blinkRateReady: true,
		blinksPerMinute: 2,
		thresholdPerMin: BLINK_RATE_LOW_MAX,
		lastShownAt: 0,
		now: 1_000_000,
		notificationsAllowed: true,
		hasBlockingToast: false,
		...overrides,
	};
}

describe("shouldShowBlinkRateCoach", () => {
	it("shows when camera rate is below threshold after warmup", () => {
		expect(shouldShowBlinkRateCoach(base())).toBe(true);
	});

	it("stays quiet when rate meets or exceeds threshold", () => {
		expect(
			shouldShowBlinkRateCoach(base({ blinksPerMinute: BLINK_RATE_LOW_MAX })),
		).toBe(false);
		expect(shouldShowBlinkRateCoach(base({ blinksPerMinute: 10 }))).toBe(false);
	});

	it("respects cooldown after a prior notice", () => {
		const now = 1_000_000;
		expect(
			shouldShowBlinkRateCoach(
				base({
					lastShownAt: now - BLINK_RATE_COACH_COOLDOWN_MS + 1,
					now,
				}),
			),
		).toBe(false);
		expect(
			shouldShowBlinkRateCoach(
				base({
					lastShownAt: now - BLINK_RATE_COACH_COOLDOWN_MS,
					now,
				}),
			),
		).toBe(true);
	});

	it("never shows before warmup is ready", () => {
		expect(shouldShowBlinkRateCoach(base({ blinkRateReady: false }))).toBe(
			false,
		);
	});

	it("never shows in timer-only mode", () => {
		expect(shouldShowBlinkRateCoach(base({ cameraEnabled: false }))).toBe(
			false,
		);
	});

	it("respects enable pref, tracking, gate, and blocking toasts", () => {
		expect(shouldShowBlinkRateCoach(base({ enabled: false }))).toBe(false);
		expect(shouldShowBlinkRateCoach(base({ isTracking: false }))).toBe(false);
		expect(
			shouldShowBlinkRateCoach(base({ notificationsAllowed: false })),
		).toBe(false);
		expect(shouldShowBlinkRateCoach(base({ hasBlockingToast: true }))).toBe(
			false,
		);
	});
});
