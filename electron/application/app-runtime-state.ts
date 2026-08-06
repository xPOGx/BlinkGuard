export class AppRuntimeState {
	blinkInterval: ReturnType<typeof setInterval> | null = null;
	cameraMonitoringInterval: ReturnType<typeof setInterval> | null = null;
	exerciseInterval: ReturnType<typeof setInterval> | null = null;
	exerciseSnoozeTimeout: ReturnType<typeof setTimeout> | null = null;
	cameraThresholdUpdateTimeout: ReturnType<typeof setTimeout> | null = null;
	noFaceDebounceTimer: ReturnType<typeof setTimeout> | null = null;

	blinkReminderActive = false;
	mgdReminderLoopActive = false;
	isExerciseShowing = false;
	isFaceDetected = false;
	isAutoResuming = false;
	wasTrackingBeforeSleep = false;
	wasCameraEnabledBeforeSleep = false;
	/** Last real blink / grace credit (never auto-dismiss). */
	lastBlinkTime = Date.now();
	/** Last reminder show/auto-dismiss; used to avoid spam without forging blink credit. */
	lastReminderShownAt = Date.now();

	clearReminderTimers(): void {
		if (this.blinkInterval) clearInterval(this.blinkInterval);
		if (this.cameraMonitoringInterval) clearInterval(this.cameraMonitoringInterval);
		if (this.cameraThresholdUpdateTimeout) {
			clearTimeout(this.cameraThresholdUpdateTimeout);
		}
		this.blinkInterval = null;
		this.cameraMonitoringInterval = null;
		this.cameraThresholdUpdateTimeout = null;
		this.blinkReminderActive = false;
		this.mgdReminderLoopActive = false;
	}

	clearExerciseTimers(): void {
		if (this.exerciseInterval) clearInterval(this.exerciseInterval);
		if (this.exerciseSnoozeTimeout) clearTimeout(this.exerciseSnoozeTimeout);
		this.exerciseInterval = null;
		this.exerciseSnoozeTimeout = null;
		this.isExerciseShowing = false;
	}
}
