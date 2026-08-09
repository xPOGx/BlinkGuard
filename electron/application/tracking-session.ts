import type { AppPreferences } from "../../shared/preferences";
import type { ExerciseService } from "./exercise-service";
import type { LookAwayService } from "./look-away-service";
import type { ReminderService } from "./reminder-service";

/** Collaborators for a blink-tracking session that also owns eye-care timers. */
export type TrackingSessionDeps = {
	reminders: Pick<ReminderService, "start" | "stop" | "ensureStopped">;
	exercises: Pick<ExerciseService, "start" | "stop" | "resetTimer">;
	lookAway: Pick<LookAwayService, "start" | "stop" | "resetTimer">;
	preferences: Pick<
		AppPreferences,
		"eyeExercisesEnabled" | "lookAwayEnabled" | "reminderInterval"
	>;
};

/**
 * Stop blink tracking and pause exercise / look-away timers (prefs unchanged).
 * Use `showStatus: false` for silent teardown (e.g. cancel auto-resume).
 */
export function stopTrackingSession(
	deps: TrackingSessionDeps,
	showStatus = true,
): void {
	if (showStatus) {
		deps.reminders.stop(true);
	} else {
		deps.reminders.ensureStopped();
	}
	deps.exercises.stop();
	deps.lookAway.stop();
}

/**
 * Start blink tracking and resume eye-care timers when their prefs are on.
 * Resets eye-care due clocks so Stop→Start does not fire an immediate popup.
 */
export function startTrackingSession(
	deps: TrackingSessionDeps,
	interval?: number,
): void {
	deps.reminders.start(interval ?? deps.preferences.reminderInterval);
	if (deps.preferences.eyeExercisesEnabled) {
		deps.exercises.resetTimer();
		deps.exercises.start();
	}
	if (deps.preferences.lookAwayEnabled) {
		deps.lookAway.resetTimer();
		deps.lookAway.start();
	}
}
