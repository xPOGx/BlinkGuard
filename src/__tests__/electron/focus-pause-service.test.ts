import { describe, expect, it, vi } from "vitest";
import { FocusPauseService } from "../../../electron/application/focus-pause-service";
import { DEFAULT_PREFERENCES } from "../../../shared/preferences";

describe("FocusPauseService pushState", () => {
	it("includes fullscreenDetectionSupported in the payload", () => {
		const sendToMain = vi.fn();
		const service = new FocusPauseService(
			{ ...DEFAULT_PREFERENCES },
			{
				closeReminder: vi.fn(),
				closeExercise: vi.fn(),
				closeLookAway: vi.fn(),
				hideNoFace: vi.fn(),
				hideBlinkRateCoach: vi.fn(),
				sendToMain,
			},
			{
				pauseCameraForFocus: vi.fn(),
				resumeCameraIfNeeded: vi.fn(),
			} as never,
			"focus-pause-state",
			false,
		);

		service.pushState();

		expect(sendToMain).toHaveBeenCalledWith("focus-pause-state", {
			reason: null,
			fullscreenDetectionSupported: false,
		});
	});
});
