import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlinkRateCoachingService } from "../../../electron/application/blink-rate-coaching-service";
import type { BlinkRateCoachWindowPort } from "../../../electron/application/ports/runtime-ports";
import { BLINK_RATE_COACH_COOLDOWN_MS } from "../../../electron/domain/blink-rate-coaching";
import {
	type AppPreferences,
	DEFAULT_PREFERENCES,
} from "../../../shared/preferences";

function createPrefs(overrides: Partial<AppPreferences> = {}): AppPreferences {
	return {
		...DEFAULT_PREFERENCES,
		cameraEnabled: true,
		isTracking: true,
		blinkRateCoachingEnabled: true,
		blinkRateThresholdPerMin: 4,
		...overrides,
	};
}

function createWindows(): BlinkRateCoachWindowPort {
	return {
		showBlinkRateCoach: vi.fn(),
		hideBlinkRateCoach: vi.fn(),
		hasBlinkRateCoach: vi.fn(() => false),
		hasReminder: vi.fn(() => false),
		hasNoFace: vi.fn(() => false),
	};
}

describe("BlinkRateCoachingService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("shows a soft toast when camera BPM is low after warmup", () => {
		const windows = createWindows();
		const stats = {
			getSnapshot: vi.fn(() => ({
				blinksPerMinute: 2,
				blinkRateReady: true,
			})),
		};
		const service = new BlinkRateCoachingService(createPrefs(), stats, windows);

		service.start();

		expect(windows.showBlinkRateCoach).toHaveBeenCalledTimes(1);
		service.dispose();
	});

	it("stays quiet when rate is healthy or coaching is disabled", () => {
		const windows = createWindows();
		const stats = {
			getSnapshot: vi.fn(() => ({
				blinksPerMinute: 8,
				blinkRateReady: true,
			})),
		};
		const prefs = createPrefs({ blinkRateCoachingEnabled: false });
		const service = new BlinkRateCoachingService(prefs, stats, windows);

		service.start();
		expect(windows.showBlinkRateCoach).not.toHaveBeenCalled();

		prefs.blinkRateCoachingEnabled = true;
		service.evaluate();
		expect(windows.showBlinkRateCoach).not.toHaveBeenCalled();
		service.dispose();
	});

	it("does not start in timer-only mode", () => {
		const windows = createWindows();
		const stats = {
			getSnapshot: vi.fn(() => ({
				blinksPerMinute: 0,
				blinkRateReady: true,
			})),
		};
		const service = new BlinkRateCoachingService(
			createPrefs({ cameraEnabled: false }),
			stats,
			windows,
		);

		service.start();
		expect(windows.showBlinkRateCoach).not.toHaveBeenCalled();
		expect(stats.getSnapshot).not.toHaveBeenCalled();
		service.dispose();
	});

	it("respects cooldown between notices", () => {
		const windows = createWindows();
		const stats = {
			getSnapshot: vi.fn(() => ({
				blinksPerMinute: 1,
				blinkRateReady: true,
			})),
		};
		const service = new BlinkRateCoachingService(createPrefs(), stats, windows);

		service.start();
		expect(windows.showBlinkRateCoach).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(15_000);
		expect(windows.showBlinkRateCoach).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(BLINK_RATE_COACH_COOLDOWN_MS);
		expect(windows.showBlinkRateCoach).toHaveBeenCalledTimes(2);
		service.dispose();
	});
});
