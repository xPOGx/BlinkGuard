export interface ReminderWindowPort {
	showReminder(kind: "starting" | "blink" | "stopped"): unknown | null;
	closeReminder(): void;
	closeReminderIfCurrent(token: unknown): boolean;
	hasReminder(): boolean;
	showNoFace(): void;
	hideNoFace(): void;
	hasNoFace(): boolean;
	showBlinkRateCoach(): void;
	hideBlinkRateCoach(): void;
	hasBlinkRateCoach(): boolean;
	closeCamera(): void;
	sendToMain(channel: string, ...args: unknown[]): void;
	sendPreferences(): void;
}

/** Soft blink-rate coach toast surface (subset used by FocusPause + coaching). */
export interface BlinkRateCoachWindowPort {
	showBlinkRateCoach(): void;
	hideBlinkRateCoach(): void;
	hasBlinkRateCoach(): boolean;
	hasReminder(): boolean;
	hasNoFace(): boolean;
}

export interface BlinkDetectorPort {
	readonly isRunning: boolean;
	readonly isCameraReady: boolean;
	start(): void;
	startCamera(): boolean;
	stopCamera(): void;
	markCameraUnavailable(): void;
}

export interface ExerciseWindowPort {
	showExercise(prompt: string, onClosed: () => void): unknown | null;
	closeExercise(): void;
	closeExerciseIfCurrent(token: unknown): boolean;
}

export interface LookAwayWindowPort {
	showLookAway(onClosed: () => void): unknown | null;
	closeLookAway(): void;
	closeLookAwayIfCurrent(token: unknown): boolean;
}

export interface NotificationSoundPort {
	play(
		kind: "blink" | "exercise" | "lookAway" | "starting" | "stopped",
		options?: { force?: boolean; volume?: number },
	): void;
}
