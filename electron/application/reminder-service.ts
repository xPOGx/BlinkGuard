import type { AppPreferences } from "../../shared/preferences";
import {
	CAMERA_POLL_INTERVAL_MS,
	REMINDER_POPUP_VISIBLE_MS,
	nextTimerReminderDelay,
	shouldShowCameraReminder,
} from "../domain/reminder-policy";
import type { AppRuntimeState } from "./app-runtime-state";
import type {
	BlinkDetectorPort,
	NotificationSoundPort,
	ReminderWindowPort,
} from "./ports/runtime-ports";

export class ReminderService {
	constructor(
		private readonly preferences: AppPreferences,
		private readonly state: AppRuntimeState,
		private readonly windows: ReminderWindowPort,
		private readonly sidecar: BlinkDetectorPort,
		private readonly sound: NotificationSoundPort,
	) {}

	start(interval = this.preferences.reminderInterval): void {
		this.ensureStopped();
		this.preferences.isTracking = true;
		this.preferences.reminderInterval = interval;
		if (this.preferences.cameraEnabled) {
			this.startCameraMonitoring();
		} else {
			this.startTimerLoop();
		}
	}

	stop(showStatus = true): void {
		this.ensureStopped();
		this.windows.closeCamera();
		if (showStatus) this.windows.showReminder("stopped");
	}

	ensureStopped(): void {
		this.state.clearReminderTimers();
		this.state.isAutoResuming = false;
		this.preferences.isTracking = false;
		this.sidecar.stopCamera();
		this.resetFaceTracking();
		this.windows.closeReminder();
		this.windows.sendToMain("stop-camera");
	}

	onBlink(): void {
		this.state.lastBlinkTime = Date.now();
		this.windows.closeReminder();
	}

	onFaceDetection(faceDetected: boolean): void {
		if (!this.preferences.isTracking || !this.preferences.cameraEnabled) return;
		if (faceDetected) {
			const wasDetected = this.state.isFaceDetected;
			this.state.isFaceDetected = true;
			this.cancelNoFaceDebounce();
			this.windows.hideNoFace();
			if (!wasDetected) this.state.lastBlinkTime = Date.now();
			return;
		}
		if (
			this.state.noFaceDebounceTimer ||
			this.windows.hasNoFace()
		) {
			return;
		}
		this.state.noFaceDebounceTimer = setTimeout(() => {
			this.state.noFaceDebounceTimer = null;
			if (!this.preferences.isTracking || !this.preferences.cameraEnabled) {
				return;
			}
			this.state.isFaceDetected = false;
			this.windows.closeReminder();
			this.windows.showNoFace();
		}, 750);
	}

	resumeAfterSleep(useCamera: boolean): void {
		this.state.isAutoResuming = true;
		this.state.lastBlinkTime = Date.now();
		this.preferences.isTracking = true;
		if (useCamera) {
			this.startCameraMonitoring(false);
		} else {
			this.startTimerLoop();
		}
		this.windows.sendPreferences();
		setTimeout(() => {
			this.state.isAutoResuming = false;
		}, 3000);
	}

	/** Ensure camera sidecar is running so preview / face tracking can work. */
	ensureCameraActive(): void {
		if (!this.preferences.cameraEnabled) return;
		if (!this.preferences.isTracking) {
			this.start();
			return;
		}
		if (!this.sidecar.isRunning) this.sidecar.start();
		if (!this.sidecar.isCameraReady) this.sidecar.startCamera();
	}

	private startTimerLoop(): void {
		this.state.blinkReminderActive = true;
		this.sound.play("blink");
		this.windows.showReminder("blink");
		this.state.blinkInterval = setInterval(() => {
			if (this.state.blinkReminderActive && this.preferences.isTracking) {
				this.sound.play("blink");
				this.windows.showReminder("blink");
			} else {
				this.state.clearReminderTimers();
			}
		}, nextTimerReminderDelay(this.preferences.reminderInterval));
	}

	private startCameraMonitoring(showStarting = true): void {
		if (this.state.cameraMonitoringInterval) {
			clearInterval(this.state.cameraMonitoringInterval);
		}
		this.sidecar.markCameraUnavailable();
		this.resetFaceTracking();
		if (showStarting) {
			const popup = this.windows.showReminder("starting");
			setTimeout(() => {
				this.windows.closeReminderIfCurrent(popup);
			}, REMINDER_POPUP_VISIBLE_MS);
		}
		if (!this.sidecar.isRunning) this.sidecar.start();
		if (!this.sidecar.startCamera()) return;

		const waitForCamera = setInterval(() => {
			if (!this.preferences.isTracking) {
				clearInterval(waitForCamera);
				return;
			}
			if (!this.sidecar.isRunning || !this.sidecar.isCameraReady) return;
			clearInterval(waitForCamera);
			this.state.lastBlinkTime = Date.now();
			if (this.preferences.mgdMode) {
				this.startMgdLoop();
			} else {
				this.startFaceAwareLoop();
			}
		}, CAMERA_POLL_INTERVAL_MS);
	}

	private startMgdLoop(): void {
		this.state.mgdReminderLoopActive = true;
		if (this.state.blinkInterval) clearInterval(this.state.blinkInterval);
		this.state.blinkInterval = setInterval(() => {
			if (
				this.state.mgdReminderLoopActive &&
				this.preferences.isTracking &&
				this.preferences.mgdMode &&
				this.sidecar.isRunning
			) {
				if (this.state.isFaceDetected) {
					this.sound.play("blink");
					this.windows.showReminder("blink");
				}
			} else {
				this.state.clearReminderTimers();
			}
		}, nextTimerReminderDelay(this.preferences.reminderInterval));
	}

	private startFaceAwareLoop(): void {
		this.state.cameraMonitoringInterval = setInterval(() => {
			if (!this.preferences.isTracking || !this.sidecar.isRunning) {
				this.state.clearReminderTimers();
				return;
			}
			if (
				shouldShowCameraReminder({
					isTracking: this.preferences.isTracking,
					isDetectorRunning: this.sidecar.isRunning,
					isFaceDetected: this.state.isFaceDetected,
					hasPopup: this.windows.hasReminder(),
					timeSinceLastBlinkMs: Date.now() - this.state.lastBlinkTime,
					reminderIntervalMs: this.preferences.reminderInterval,
				})
			) {
				this.sound.play("blink");
				const popup = this.windows.showReminder("blink");
				setTimeout(() => {
					if (this.windows.closeReminderIfCurrent(popup)) {
						this.state.lastBlinkTime = Date.now();
					}
				}, REMINDER_POPUP_VISIBLE_MS);
			}
		}, CAMERA_POLL_INTERVAL_MS);
	}

	private resetFaceTracking(): void {
		this.state.isFaceDetected = false;
		this.cancelNoFaceDebounce();
		this.windows.hideNoFace();
	}

	private cancelNoFaceDebounce(): void {
		if (this.state.noFaceDebounceTimer) {
			clearTimeout(this.state.noFaceDebounceTimer);
			this.state.noFaceDebounceTimer = null;
		}
	}
}
