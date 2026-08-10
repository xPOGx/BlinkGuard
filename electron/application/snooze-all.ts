import type { AppRuntimeState } from "./app-runtime-state";
import type { ExerciseService } from "./exercise-service";
import type { LookAwayService } from "./look-away-service";
import type { ReminderService } from "./reminder-service";

export type SnoozeAllDeps = {
	reminders: Pick<ReminderService, "snooze">;
	exercises: Pick<ExerciseService, "snooze">;
	lookAway: Pick<LookAwayService, "snooze">;
	state: Pick<AppRuntimeState, "isExerciseShowing" | "isLookAwayShowing">;
};

/**
 * Snooze blink prompts always; exercise / look-away only when their popup is up
 * (those services schedule a delayed show on snooze).
 */
export function snoozeAllPrompts(deps: SnoozeAllDeps): void {
	deps.reminders.snooze();
	if (deps.state.isExerciseShowing) {
		deps.exercises.snooze();
	}
	if (deps.state.isLookAwayShowing) {
		deps.lookAway.snooze();
	}
}
