import type { AppPreferences } from "../../shared/preferences";
import type { AppRuntimeState } from "./app-runtime-state";
import type { PreferenceStore } from "./ports/preference-store";
import type {
	ExerciseWindowPort,
	NotificationSoundPort,
} from "./ports/runtime-ports";

export class ExerciseService {
	constructor(
		private readonly preferences: AppPreferences,
		private readonly state: AppRuntimeState,
		private readonly store: PreferenceStore,
		private readonly windows: ExerciseWindowPort,
		private readonly sound: NotificationSoundPort,
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
				this.store.set("lastExerciseTime", now);
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
		this.sound.play("exercise");
		this.state.isExerciseShowing = true;
		const popup = this.windows.showExercise(() => {
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
