import {
	sanitizeExercisePrompts,
	type AppPreferences,
} from "../../shared/preferences";
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
			5 * 60 * 1000,
		);
	}

	resetTimer(): void {
		this.store.set("lastExerciseTime", Date.now());
	}

	private show(): void {
		if (this.state.isExerciseShowing) return;
		if (!this.notificationGate.notificationsAllowed()) return;
		this.sound.play("exercise");
		this.state.isExerciseShowing = true;
		this.store.set("lastExerciseTime", Date.now());

		const prompts = sanitizeExercisePrompts(this.preferences.exercisePrompts);
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
		}, 30_000);
	}

	private closePopup(): void {
		this.windows.closeExercise();
		this.state.isExerciseShowing = false;
	}
}
