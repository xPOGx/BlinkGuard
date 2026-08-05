import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRuntimeState } from "../../../electron/application/app-runtime-state";

describe("AppRuntimeState", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("clearReminderTimers clears intervals/timeouts and reminder flags", () => {
		vi.useFakeTimers();
		const state = new AppRuntimeState();
		state.blinkReminderActive = true;
		state.mgdReminderLoopActive = true;
		state.blinkInterval = setInterval(() => {}, 1000);
		state.cameraMonitoringInterval = setInterval(() => {}, 100);
		state.cameraThresholdUpdateTimeout = setTimeout(() => {}, 500);

		state.clearReminderTimers();

		expect(state.blinkInterval).toBeNull();
		expect(state.cameraMonitoringInterval).toBeNull();
		expect(state.cameraThresholdUpdateTimeout).toBeNull();
		expect(state.blinkReminderActive).toBe(false);
		expect(state.mgdReminderLoopActive).toBe(false);
	});

	it("clearExerciseTimers clears exercise timers and showing flag", () => {
		vi.useFakeTimers();
		const state = new AppRuntimeState();
		state.isExerciseShowing = true;
		state.exerciseInterval = setInterval(() => {}, 60_000);
		state.exerciseSnoozeTimeout = setTimeout(() => {}, 5_000);

		state.clearExerciseTimers();

		expect(state.exerciseInterval).toBeNull();
		expect(state.exerciseSnoozeTimeout).toBeNull();
		expect(state.isExerciseShowing).toBe(false);
	});
});
