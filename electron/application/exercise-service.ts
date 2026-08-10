import { resolveExercisePrompts } from "../../shared/i18n";
import {
	sanitizeExercisePrompts,
	type AppPreferences,
} from "../../shared/preferences";
import {
	EXERCISE_POPUP_VISIBLE_MS,
	promptSnoozeMs,
} from "../domain/reminder-policy";
import type { AppRuntimeState } from "./app-runtime-state";
import type { PreferenceStore } from "./ports/preference-store";
import type { NotificationGate } from "./ports/notification-gate";
import type {
	ExerciseWindowPort,
	NotificationSoundPort,
} from "./ports/runtime-ports";

const ALLOW_ALL_GATE: NotificationGate = {
	notificationsAllowed: () => true,
	pauseReason: () => null,
};

export class ExerciseService {
	constructor(
		private readonly preferences: AppPreferences,
		private readonly state: AppRuntimeState,
		private readonly store: PreferenceStore,
		private readonly windows: ExerciseWindowPort,
		private readonly sound: NotificationSoundPort,
		private readonly notificationGate: NotificationGate = ALLOW_ALL_GATE,
	) {}

	start(): void {
		if (this.state.exerciseInterval) clearInterval(this.state.exerciseInterval);
		this.state.exerciseInterval = setInterval(() => {
			const now = Date.now();
			const elapsed = now - this.store.get("lastExerciseTime", 0);
			if (
				this.preferences.eyeExercisesEnabled &&
				!this.state.isExerciseShowing &&
				elapsed >= this.preferences.exerciseInterval * 60 * 1000
			) {
				this.show();
			}
		}, 60 * 1000);
	}

	stop(): void {
		this.state.clearExerciseTimers();
		this.windows.closeExercise();
	}

	skip(): void {
		this.closePopup();
		this.store.set("lastExerciseTime", Date.now());
	}

	snooze(): void {
		this.closePopup();
		if (this.state.exerciseSnoozeTimeout) {
			clearTimeout(this.state.exerciseSnoozeTimeout);
		}
		this.state.exerciseSnoozeTimeout = setTimeout(
			() => this.show(),
			promptSnoozeMs(this.preferences.snoozeMinutes),
		);
	}

	resetTimer(): void {
		this.store.set("lastExerciseTime", Date.now());
	}

	private show(): void {
		if (this.state.isExerciseShowing) return;
		if (this.state.isLookAwayShowing) return;
		if (this.shouldDeferForLookAway()) return;
		if (!this.notificationGate.notificationsAllowed()) return;
		this.sound.play("exercise");
		this.state.isExerciseShowing = true;
		this.store.set("lastExerciseTime", Date.now());

		const locale = this.preferences.locale === "uk" ? "uk" : "en";
		const prompts = resolveExercisePrompts(
			sanitizeExercisePrompts(this.preferences.exercisePrompts, locale),
			locale,
		);
		const rawIndex = this.store.get("exercisePromptIndex", 0);
		const index =
			(typeof rawIndex === "number" && Number.isFinite(rawIndex)
				? Math.floor(rawIndex)
				: 0) % prompts.length;
		const prompt = prompts[index];
		this.store.set("exercisePromptIndex", (index + 1) % prompts.length);

		const popup = this.windows.showExercise(prompt, () => {
			this.state.isExerciseShowing = false;
		});
		if (!popup) {
			this.state.isExerciseShowing = false;
			return;
		}
		setTimeout(() => {
			if (this.windows.closeExerciseIfCurrent(popup)) {
				this.state.isExerciseShowing = false;
			}
		}, EXERCISE_POPUP_VISIBLE_MS);
	}

	/** Prefer 20-20-20 when both eye-care prompts are due in the same tick. */
	private shouldDeferForLookAway(): boolean {
		if (!this.preferences.lookAwayEnabled) return false;
		const elapsed =
			Date.now() - this.store.get("lastLookAwayTime", 0);
		return elapsed >= this.preferences.lookAwayInterval * 60 * 1000;
	}

	private closePopup(): void {
		this.windows.closeExercise();
		this.state.isExerciseShowing = false;
	}
}
