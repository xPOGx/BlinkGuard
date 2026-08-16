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
	showCalibrationNudge(reason: "stale" | "drift"): void;
	hideCalibrationNudge(): void;
	hasCalibrationNudge(): boolean;
	closeCamera(): void;
	sendToMain(channel: string, ...args: unknown[]): void;
	sendPreferences(): void;
}

/** Soft blink-rate coach toast surface (subset used by FocusPause + coaching). */
export interface BlinkRateCoachWindowPort {
	showBlinkRateCoach(): void;
	hideBlinkRateCoach(): void;
	hasBlinkRateCoach(): boolean;
	hasCalibrationNudge(): boolean;
	hasReminder(): boolean;
	hasNoFace(): boolean;
}

export interface CalibrationNudgeWindowPort {
	showCalibrationNudge(reason: "stale" | "drift"): void;
	hideCalibrationNudge(): void;
	hasCalibrationNudge(): boolean;
	hasBlinkRateCoach(): boolean;
	hasReminder(): boolean;
	hasNoFace(): boolean;
	sendToMain(channel: string, ...args: unknown[]): void;
}

export interface BlinkDetectorPort {
	readonly isRunning: boolean;
	readonly isCameraReady: boolean;
	start(): void;
	startCamera(): boolean;
	stopCamera(): void;
	requestVideo(): void;
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
		kind: "blink" | "exercise" | "lookAway" | "starting" | "stopped" | "cheer",
		options?: { force?: boolean; volume?: number },
	): void;
}

export type OsToastKind = "blink" | "exercise" | "lookAway";

export type OsToastShowResult = { shown: boolean };

export type OsToastPayload = {
	title: string;
	body: string;
	snoozeLabel: string;
};

export interface OsNotificationPort {
	isSupported(): boolean;
	show(
		kind: OsToastKind,
		payload: OsToastPayload,
		hooks?: { onFailed?: () => void },
	): OsToastShowResult;
	dismiss(kind: OsToastKind): void;
	dismissAll(): void;
	setActivationHandlers(handlers: {
		onClick: (kind: OsToastKind) => void;
		onSnooze: (kind: OsToastKind) => void;
	}): void;
}

/** Default when tests / callers omit the port — native is treated as unsupported (overlay fallback). */
export const NO_OP_OS_NOTIFICATIONS: OsNotificationPort = {
	isSupported: () => false,
	show: () => ({ shown: false }),
	dismiss: () => {},
	dismissAll: () => {},
	setActivationHandlers: () => {},
};
