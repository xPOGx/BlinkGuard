import { describe, expect, it, vi } from "vitest";
import { snoozeAllPrompts } from "../../../electron/application/snooze-all";

describe("snoozeAllPrompts", () => {
	it("always snoozes blink and only active exercise / look-away popups", () => {
		const reminders = { snooze: vi.fn() };
		const exercises = { snooze: vi.fn() };
		const lookAway = { snooze: vi.fn() };

		snoozeAllPrompts({
			reminders,
			exercises,
			lookAway,
			state: { isExerciseShowing: false, isLookAwayShowing: true },
		});

		expect(reminders.snooze).toHaveBeenCalledOnce();
		expect(exercises.snooze).not.toHaveBeenCalled();
		expect(lookAway.snooze).toHaveBeenCalledOnce();
	});

	it("snoozes exercise when its popup is showing", () => {
		const reminders = { snooze: vi.fn() };
		const exercises = { snooze: vi.fn() };
		const lookAway = { snooze: vi.fn() };

		snoozeAllPrompts({
			reminders,
			exercises,
			lookAway,
			state: { isExerciseShowing: true, isLookAwayShowing: false },
		});

		expect(exercises.snooze).toHaveBeenCalledOnce();
		expect(lookAway.snooze).not.toHaveBeenCalled();
	});
});
