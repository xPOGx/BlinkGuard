export interface ReminderWindowPort {
	showReminder(kind: "starting" | "blink" | "stopped"): unknown | null;
	closeReminder(): void;
	closeReminderIfCurrent(token: unknown): boolean;
	hasReminder(): boolean;
	showNoFace(): void;
	hideNoFace(): void;
	hasNoFace(): boolean;
	closeCamera(): void;
	sendToMain(channel: string, ...args: unknown[]): void;
	sendPreferences(): void;
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
	showExercise(onClosed: () => void): unknown | null;
	closeExercise(): void;
	closeExerciseIfCurrent(token: unknown): boolean;
}

export interface NotificationSoundPort {
	play(kind: "blink" | "exercise" | "stopped"): void;
}
