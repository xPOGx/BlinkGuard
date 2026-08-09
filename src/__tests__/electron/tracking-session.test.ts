import { describe, expect, it, vi } from "vitest";
import {
	startTrackingSession,
	stopTrackingSession,
	type TrackingSessionDeps,
} from "../../../electron/application/tracking-session";

function createDeps(
	overrides: Partial<{
		eyeExercisesEnabled: boolean;
		lookAwayEnabled: boolean;
		reminderInterval: number;
	}> = {},
): TrackingSessionDeps & {
	reminders: {
		start: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
		ensureStopped: ReturnType<typeof vi.fn>;
	};
	exercises: {
		start: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
		resetTimer: ReturnType<typeof vi.fn>;
	};
	lookAway: {
		start: ReturnType<typeof vi.fn>;
		stop: ReturnType<typeof vi.fn>;
		resetTimer: ReturnType<typeof vi.fn>;
	};
} {
	return {
		reminders: {
			start: vi.fn(),
			stop: vi.fn(),
			ensureStopped: vi.fn(),
		},
		exercises: {
			start: vi.fn(),
			stop: vi.fn(),
			resetTimer: vi.fn(),
		},
		lookAway: {
			start: vi.fn(),
			stop: vi.fn(),
			resetTimer: vi.fn(),
		},
		preferences: {
			eyeExercisesEnabled: overrides.eyeExercisesEnabled ?? true,
			lookAwayEnabled: overrides.lookAwayEnabled ?? true,
			reminderInterval: overrides.reminderInterval ?? 5000,
		},
	};
}

describe("tracking-session", () => {
	it("stopTrackingSession stops blink and eye-care timers with status", () => {
		const deps = createDeps();
		stopTrackingSession(deps, true);
		expect(deps.reminders.stop).toHaveBeenCalledWith(true);
		expect(deps.reminders.ensureStopped).not.toHaveBeenCalled();
		expect(deps.exercises.stop).toHaveBeenCalledOnce();
		expect(deps.lookAway.stop).toHaveBeenCalledOnce();
	});

	it("stopTrackingSession can tear down silently", () => {
		const deps = createDeps();
		stopTrackingSession(deps, false);
		expect(deps.reminders.ensureStopped).toHaveBeenCalledOnce();
		expect(deps.reminders.stop).not.toHaveBeenCalled();
		expect(deps.exercises.stop).toHaveBeenCalledOnce();
		expect(deps.lookAway.stop).toHaveBeenCalledOnce();
	});

	it("startTrackingSession starts blink and resumes enabled eye-care", () => {
		const deps = createDeps({
			eyeExercisesEnabled: true,
			lookAwayEnabled: true,
			reminderInterval: 4000,
		});
		startTrackingSession(deps);
		expect(deps.reminders.start).toHaveBeenCalledWith(4000);
		expect(deps.exercises.resetTimer).toHaveBeenCalledOnce();
		expect(deps.exercises.start).toHaveBeenCalledOnce();
		expect(deps.lookAway.resetTimer).toHaveBeenCalledOnce();
		expect(deps.lookAway.start).toHaveBeenCalledOnce();
	});

	it("startTrackingSession skips disabled eye-care prefs", () => {
		const deps = createDeps({
			eyeExercisesEnabled: false,
			lookAwayEnabled: false,
		});
		startTrackingSession(deps, 3000);
		expect(deps.reminders.start).toHaveBeenCalledWith(3000);
		expect(deps.exercises.start).not.toHaveBeenCalled();
		expect(deps.lookAway.start).not.toHaveBeenCalled();
	});
});
