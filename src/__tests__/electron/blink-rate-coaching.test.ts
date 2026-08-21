import { describe, expect, it } from "vitest";
import {
	BLINK_RATE_COACH_DISMISS_MS,
	isLowBpmCoachingActive,
} from "../../../electron/domain/blink-rate-coaching";

describe("blink-rate-coaching domain (retargeted)", () => {
	it("keeps toast dismiss duration for WindowManager cheer/nudge", () => {
		expect(BLINK_RATE_COACH_DISMISS_MS).toBe(5_000);
	});

	it("re-exports isLowBpmCoachingActive from reminder-prompt-policy", () => {
		expect(
			isLowBpmCoachingActive({
				cameraEnabled: true,
				isTracking: true,
				blinkRateCoachingEnabled: true,
				blinkRateReady: true,
				blinksPerMinute: 2,
				thresholdPerMin: 4,
			}),
		).toBe(true);
	});
});
