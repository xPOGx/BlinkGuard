import { IPC_CHANNELS } from "../../shared/ipc-channels";
import { t } from "../../shared/i18n";
import {
	resolvePromptSurfaces,
	withNativeFallback,
} from "../../shared/notification-style";
import type { AppPreferences } from "../../shared/preferences";
import {
	BLINK_CREDIT_DEBOUNCE_MS,
	CAMERA_POLL_INTERVAL_MS,
	FACE_RETURN_DEBOUNCE_MS,
	NO_FACE_DEBOUNCE_MS,
	REMINDER_POPUP_VISIBLE_MS,
	autoStopNoFaceDelayMs,
	type BlinkCreditSource,
	nextTimerReminderDelay,
	promptSnoozeMs,
	shouldArmAutoStopOnNoFace,
	shouldShowCameraReminder,
} from "../domain/reminder-policy";
import type { AppRuntimeState } from "./app-runtime-state";
import type { BlinkRateCoachingPort, BlinkStatsPort, CalibrationNudgePort } from "./ports/blink-stats-port";
import type { PreferenceStore } from "./ports/preference-store";
import type { NotificationGate } from "./ports/notification-gate";
import {
	NO_OP_OS_NOTIFICATIONS,
	type BlinkDetectorPort,
	type NotificationSoundPort,
	type OsNotificationPort,
	type ReminderWindowPort,
} from "./ports/runtime-ports";

const ALLOW_ALL_GATE: NotificationGate = {
	notificationsAllowed: () => true,
	pauseReason: () => null,
};

export type CameraPauseReason = "focus" | "session";

export class ReminderService {
	private lastDetectedBlinkAt = 0;
	private readonly cameraPauseReasons = new Set<CameraPauseReason>();
	private trackingSessionStop: ((showStatus: boolean) => void) | null = null;
	private blinkSession: { overlay: unknown | null } | null = null;

	constructor(
		private readonly preferences: AppPreferences,
		private readonly state: AppRuntimeState,
		private readonly windows: ReminderWindowPort,
		private readonly sidecar: BlinkDetectorPort,
		private readonly sound: NotificationSoundPort,
		private readonly store: PreferenceStore,
		private readonly stats: BlinkStatsPort | null = null,
		private readonly notificationGate: NotificationGate = ALLOW_ALL_GATE,
		private readonly coaching: BlinkRateCoachingPort | null = null,
		private readonly calibrationNudge: CalibrationNudgePort | null = null,
		private readonly osNotifications: OsNotificationPort = NO_OP_OS_NOTIFICATIONS,
	) {}

	/**
	 * Late-bind session teardown so no-face auto-stop can pause eye-care
	 * when coupled (`eyeCareIndependentOfTracking === false`).
	 * Exercises / look-away are constructed after this service in main.
	 */
	bindTrackingSessionStop(handler: (showStatus: boolean) => void): void {
		this.trackingSessionStop = handler;
	}

	start(interval = this.preferences.reminderInterval): void {
		this.ensureStopped();
		this.setTracking(true);
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
		if (showStatus) {
			this.sound.play("stopped");
			this.windows.showReminder("stopped");
		}
	}

	ensureStopped(): void {
		this.state.clearReminderTimers();
		this.state.isAutoResuming = false;
		this.cameraPauseReasons.clear();
		this.coaching?.stop();
		this.calibrationNudge?.stop();
		this.setTracking(false);
		this.sidecar.stopCamera();
		this.resetFaceTracking();
		this.dismissVisibleBlink();
	}

	private setTracking(value: boolean): void {
		const wasTracking = this.preferences.isTracking;
		this.preferences.isTracking = value;
		this.store.set("isTracking", value);
		if (value && !wasTracking) this.stats?.onTrackingStart();
		if (!value && wasTracking) {
			this.stats?.setFaceCoverageMode(false);
			this.stats?.onTrackingStop();
		}
	}

	/** Sidecar-detected blink only. Debounced; closes any open reminder. */
	onBlink(): boolean {
		if (!this.preferences.isTracking) return false;
		if (!this.creditBlink("detected")) return false;
		this.stats?.recordBlink();
		this.dismissVisibleBlink();
		return true;
	}

	/**
	 * Credits a blink (or grace reset). Returns false when a detected blink is
	 * dropped by the main-side debounce.
	 */
	creditBlink(source: BlinkCreditSource): boolean {
		if (source === "detected") {
			const now = Date.now();
			if (now - this.lastDetectedBlinkAt < BLINK_CREDIT_DEBOUNCE_MS) {
				return false;
			}
			this.lastDetectedBlinkAt = now;
		}
		this.state.lastBlinkTime = Date.now();
		return true;
	}

	/** Close overlay + native blink toast without snoozing or stopping tracking. */
	dismissVisibleBlink(): void {
		this.windows.closeReminder();
		this.osNotifications.dismiss("blink");
		this.blinkSession = null;
	}

	/** Auto-dismiss / show cooldown — does not forge blink credit. */
	markReminderShown(): void {
		this.state.lastReminderShownAt = Date.now();
	}

	/**
	 * Suppress blink popups for {@link promptSnoozeMs}(`snoozeMinutes`).
	 * Does not forge blink credit. Loops keep running; shows resume naturally
	 * after the snooze window.
	 */
	snooze(): void {
		const ms = promptSnoozeMs(this.preferences.snoozeMinutes);
		this.dismissVisibleBlink();
		if (this.state.blinkSnoozeTimeout) {
			clearTimeout(this.state.blinkSnoozeTimeout);
		}
		this.state.blinkSnoozeUntil = Date.now() + ms;
		this.markReminderShown();
		this.state.blinkSnoozeTimeout = setTimeout(() => {
			this.state.blinkSnoozeUntil = 0;
			this.state.blinkSnoozeTimeout = null;
		}, ms);
	}

	onFaceDetection(faceDetected: boolean): void {
		if (!this.preferences.isTracking || !this.preferences.cameraEnabled) return;
		if (faceDetected) {
			this.cancelNoFaceDebounce();
			if (this.state.isFaceDetected && !this.windows.hasNoFace()) {
				this.cancelFaceReturnDebounce();
				return;
			}
			if (this.state.faceReturnDebounceTimer) return;
			this.state.faceReturnDebounceTimer = setTimeout(() => {
				this.state.faceReturnDebounceTimer = null;
				if (!this.preferences.isTracking || !this.preferences.cameraEnabled) {
					return;
				}
				const wasDetected = this.state.isFaceDetected;
				this.state.isFaceDetected = true;
				this.cancelNoFaceAutoStop();
				if (this.windows.hasNoFace()) this.windows.hideNoFace();
				if (!wasDetected) this.creditBlink("face-return");
			}, FACE_RETURN_DEBOUNCE_MS);
			return;
		}
		this.cancelFaceReturnDebounce();
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
			this.dismissVisibleBlink();
			this.windows.hideBlinkRateCoach();
			this.windows.hideCalibrationNudge();
			this.armNoFaceAutoStop();
			if (!this.notificationGate.notificationsAllowed()) return;
			this.windows.showNoFace();
		}, NO_FACE_DEBOUNCE_MS);
	}

	/**
	 * Pause reminder loops and camera without clearing persisted isTracking.
	 * Stats stop so lid-closed time does not count as tracking minutes.
	 */
	pauseForSession(): void {
		this.state.clearReminderTimers();
		this.pauseCameraForFocus("session");
		if (this.preferences.isTracking) this.stats?.onTrackingStop();
	}

	/**
	 * Soft-pause the camera while the lid is closed but an external display
	 * is still on. Timer blink reminders keep running.
	 */
	pauseCameraForClamshell(): void {
		this.pauseCameraForFocus("session");
		if (!this.preferences.isTracking) return;
		this.state.clearReminderTimers();
		this.startTimerLoop(false);
	}

	/**
	 * Restore loops after sleep / lid-open. Does not persist isTracking.
	 * `releaseCamera` drops the session camera hold; `restoreStats` restarts
	 * tracking-minute accrual after {@link pauseForSession}.
	 */
	resumeAfterSleep(
		options: { releaseCamera?: boolean; restoreStats?: boolean } = {},
	): void {
		const releaseCamera = options.releaseCamera ?? true;
		const restoreStats = options.restoreStats ?? true;
		if (releaseCamera) this.cameraPauseReasons.delete("session");
		this.state.isAutoResuming = true;
		this.creditBlink("sleep");
		if (restoreStats && this.preferences.isTracking) {
			this.stats?.onTrackingStart();
		}
		this.state.clearReminderTimers();
		if (this.preferences.isTracking) {
			if (
				this.preferences.cameraEnabled &&
				this.cameraPauseReasons.size === 0
			) {
				this.startCameraMonitoring(false);
			} else if (!this.preferences.cameraEnabled || !releaseCamera) {
				this.startTimerLoop(false);
			}
		}
		this.windows.sendPreferences();
		setTimeout(() => {
			this.state.isAutoResuming = false;
		}, 3000);
	}

	/**
	 * Mid-session MGD toggle: swap face-aware ↔ MGD loop without full stop.
	 * Pref `mgdMode` must already be updated by the caller.
	 */
	syncCameraLoopForMgdMode(): void {
		if (
			!this.preferences.isTracking ||
			!this.preferences.cameraEnabled ||
			!this.sidecar.isRunning ||
			!this.sidecar.isCameraReady
		) {
			return;
		}
		this.state.clearReminderTimers();
		this.dismissVisibleBlink();
		if (this.preferences.mgdMode) {
			this.startMgdLoop();
		} else {
			this.startFaceAwareLoop();
		}
	}

	/**
	 * Mid-session reminder-interval change: reschedule loops without stopping
	 * the camera sidecar. Pref `reminderInterval` must already be updated.
	 */
	applyReminderInterval(): void {
		if (!this.preferences.isTracking) return;

		this.state.clearReminderTimers();
		this.dismissVisibleBlink();

		if (!this.preferences.cameraEnabled) {
			// Re-arm timer cadence without an immediate popup (slider tweak).
			this.stats?.setFaceCoverageMode(false);
			this.coaching?.stop();
			this.calibrationNudge?.stop();
			this.state.blinkReminderActive = true;
			this.state.blinkInterval = setInterval(() => {
				if (this.state.blinkReminderActive && this.preferences.isTracking) {
					this.scheduleBlinkReminder();
				} else {
					this.state.clearReminderTimers();
				}
			}, nextTimerReminderDelay(this.preferences.reminderInterval));
			return;
		}

		// Still waiting for camera — wait-for-camera path will arm with new pref.
		if (!this.sidecar.isRunning || !this.sidecar.isCameraReady) {
			return;
		}

		if (this.preferences.mgdMode) {
			this.startMgdLoop();
		} else {
			this.startFaceAwareLoop();
		}
	}

	/** Ensure camera sidecar is running so preview / face tracking can work. */
	ensureCameraActive(): void {
		if (!this.preferences.cameraEnabled) return;
		if (!this.sidecar.isRunning) this.sidecar.start();
		if (this.sidecar.isCameraReady) {
			// Preview-only: do not stop/start an already-live capture.
			this.sidecar.requestVideo();
			return;
		}
		this.sidecar.startCamera();
	}

	/** Release capture when preview closes and tracking is not using the camera.
	 * While tracking, only stop JPEG preview encode. */
	stopCameraIfIdle(): void {
		if (this.preferences.isTracking) {
			this.sidecar.stopVideo();
			return;
		}
		this.sidecar.stopCamera();
	}

	/** Soft-pause camera during fullscreen / session without clearing isTracking. */
	pauseCameraForFocus(reason: CameraPauseReason = "focus"): void {
		const alreadyPaused = this.cameraPauseReasons.size > 0;
		this.cameraPauseReasons.add(reason);
		if (alreadyPaused) return;
		this.coaching?.stop();
		this.calibrationNudge?.stop();
		this.sidecar.stopCamera();
		this.resetFaceTracking();
		this.stats?.onFaceVisibility(false);
		this.dismissVisibleBlink();
	}

	/** Resume camera after fullscreen / session if tracking still wants capture. */
	resumeCameraIfNeeded(reason: CameraPauseReason = "focus"): void {
		this.cameraPauseReasons.delete(reason);
		if (this.cameraPauseReasons.size > 0) return;
		if (!this.preferences.isTracking || !this.preferences.cameraEnabled) {
			return;
		}
		if (this.sidecar.isCameraReady) {
			this.coaching?.start();
			this.calibrationNudge?.start();
			return;
		}
		this.startCameraMonitoring(false);
	}

	get isCameraSoftPaused(): boolean {
		return this.cameraPauseReasons.size > 0;
	}

	private startTimerLoop(showImmediately = true): void {
		this.stats?.setFaceCoverageMode(false);
		this.coaching?.stop();
		this.calibrationNudge?.stop();
		this.state.blinkReminderActive = true;
		if (showImmediately) this.scheduleBlinkReminder();
		this.state.blinkInterval = setInterval(() => {
			if (this.state.blinkReminderActive && this.preferences.isTracking) {
				this.scheduleBlinkReminder();
			} else {
				this.state.clearReminderTimers();
			}
		}, nextTimerReminderDelay(this.preferences.reminderInterval));
	}

	private startCameraMonitoring(showStarting = true): void {
		if (this.state.cameraMonitoringInterval) {
			clearInterval(this.state.cameraMonitoringInterval);
		}

		// Already capturing — arm reminder loops without DSHOW reopen thrash.
		if (this.sidecar.isRunning && this.sidecar.isCameraReady) {
			this.resetFaceTracking();
			if (showStarting) {
				this.sound.play("starting");
				const popup = this.windows.showReminder("starting");
				setTimeout(() => {
					this.windows.closeReminderIfCurrent(popup);
				}, REMINDER_POPUP_VISIBLE_MS);
			}
			this.coaching?.start();
			this.calibrationNudge?.start();
			this.sidecar.requestVideo();
			this.creditBlink("camera-ready");
			this.windows.sendToMain(IPC_CHANNELS.cameraReady);
			if (this.preferences.mgdMode) {
				this.startMgdLoop();
			} else {
				this.startFaceAwareLoop();
			}
			return;
		}

		this.sidecar.markCameraUnavailable();
		this.resetFaceTracking();
		if (showStarting) {
			this.sound.play("starting");
			const popup = this.windows.showReminder("starting");
			setTimeout(() => {
				this.windows.closeReminderIfCurrent(popup);
			}, REMINDER_POPUP_VISIBLE_MS);
		}
		if (!this.sidecar.isRunning) this.sidecar.start();
		if (!this.sidecar.startCamera()) return;
		this.coaching?.start();
		this.calibrationNudge?.start();

		const waitForCamera = setInterval(() => {
			if (!this.preferences.isTracking) {
				clearInterval(waitForCamera);
				return;
			}
			if (!this.sidecar.isRunning || !this.sidecar.isCameraReady) return;
			clearInterval(waitForCamera);
			this.creditBlink("camera-ready");
			this.windows.sendToMain(IPC_CHANNELS.cameraReady);
			if (this.preferences.mgdMode) {
				this.startMgdLoop();
			} else {
				this.startFaceAwareLoop();
			}
		}, CAMERA_POLL_INTERVAL_MS);
	}

	private startMgdLoop(): void {
		this.stats?.setFaceCoverageMode(false);
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
					this.showBlinkReminder();
				}
			} else {
				this.state.clearReminderTimers();
			}
		}, nextTimerReminderDelay(this.preferences.reminderInterval));
	}

	private startFaceAwareLoop(): void {
		this.stats?.setFaceCoverageMode(true);
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
					hasPopup: this.windows.hasReminder() || this.blinkSession !== null,
					timeSinceLastBlinkMs: Date.now() - this.state.lastBlinkTime,
					timeSinceLastReminderMs:
						Date.now() - this.state.lastReminderShownAt,
					reminderIntervalMs: this.preferences.reminderInterval,
				})
			) {
				this.scheduleBlinkReminder();
			}
		}, CAMERA_POLL_INTERVAL_MS);
	}

	private scheduleBlinkReminder(): void {
		const session = this.showBlinkReminder();
		if (!session) return;
		setTimeout(() => {
			this.endBlinkSessionIfCurrent(session);
		}, REMINDER_POPUP_VISIBLE_MS);
	}

	/** Soft-suppress blink popups while eye-care / quiet hours / fullscreen / snooze. */
	private showBlinkReminder(): { overlay: unknown | null } | null {
		if (this.state.isLookAwayShowing) return null;
		if (this.state.isExerciseShowing) return null;
		if (Date.now() < this.state.blinkSnoozeUntil) return null;
		if (!this.notificationGate.notificationsAllowed()) return null;
		this.windows.hideBlinkRateCoach();
		this.windows.hideCalibrationNudge();
		this.sound.play("blink");

		const locale = this.preferences.locale === "uk" ? "uk" : "en";
		const surfaces = resolvePromptSurfaces(
			this.preferences.notificationStyle,
			this.osNotifications.isSupported(),
		);
		let nativeShown = false;
		if (surfaces.native) {
			nativeShown = this.osNotifications.show(
				"blink",
				{
					title: t(locale, "popup.blink.title"),
					body: this.preferences.popupMessage,
					snoozeLabel: t(locale, "osToast.snooze"),
				},
				{ onFailed: () => this.fallbackBlinkOverlay() },
			).shown;
		}
		const planned = withNativeFallback(surfaces, nativeShown);
		let overlay: unknown | null = null;
		if (planned.overlay) {
			overlay = this.windows.showReminder("blink");
		}
		if (planned.overlay && !overlay && !planned.nativeShown) {
			return null;
		}
		const session = { overlay };
		this.blinkSession = session;
		return session;
	}

	private fallbackBlinkOverlay(): void {
		if (this.blinkSession?.overlay) return;
		if (this.state.isLookAwayShowing || this.state.isExerciseShowing) return;
		const overlay = this.windows.showReminder("blink");
		if (this.blinkSession) this.blinkSession.overlay = overlay;
	}

	private endBlinkSessionIfCurrent(session: { overlay: unknown | null }): void {
		if (this.blinkSession !== session) return;
		if (session.overlay) {
			this.windows.closeReminderIfCurrent(session.overlay);
		}
		this.osNotifications.dismiss("blink");
		this.blinkSession = null;
		this.markReminderShown();
	}

	private resetFaceTracking(): void {
		this.state.isFaceDetected = false;
		this.cancelNoFaceDebounce();
		this.cancelNoFaceAutoStop();
		this.cancelFaceReturnDebounce();
		this.windows.hideNoFace();
		this.windows.hideBlinkRateCoach();
		this.windows.hideCalibrationNudge();
	}

	private cancelNoFaceDebounce(): void {
		if (this.state.noFaceDebounceTimer) {
			clearTimeout(this.state.noFaceDebounceTimer);
			this.state.noFaceDebounceTimer = null;
		}
	}

	private cancelFaceReturnDebounce(): void {
		if (this.state.faceReturnDebounceTimer) {
			clearTimeout(this.state.faceReturnDebounceTimer);
			this.state.faceReturnDebounceTimer = null;
		}
	}

	private cancelNoFaceAutoStop(): void {
		if (this.state.noFaceAutoStopTimer) {
			clearTimeout(this.state.noFaceAutoStopTimer);
			this.state.noFaceAutoStopTimer = null;
		}
	}

	private armNoFaceAutoStop(): void {
		if (
			!shouldArmAutoStopOnNoFace({
				isTracking: this.preferences.isTracking,
				cameraEnabled: this.preferences.cameraEnabled,
				autoStopNoFaceEnabled: this.preferences.autoStopNoFaceEnabled,
				cameraSoftPaused: this.isCameraSoftPaused,
			})
		) {
			return;
		}
		if (this.state.noFaceAutoStopTimer) return;
		const delayMs = autoStopNoFaceDelayMs(
			this.preferences.autoStopNoFaceMinutes,
		);
		this.state.noFaceAutoStopTimer = setTimeout(() => {
			this.state.noFaceAutoStopTimer = null;
			if (
				!shouldArmAutoStopOnNoFace({
					isTracking: this.preferences.isTracking,
					cameraEnabled: this.preferences.cameraEnabled,
					autoStopNoFaceEnabled: this.preferences.autoStopNoFaceEnabled,
					cameraSoftPaused: this.isCameraSoftPaused,
				})
			) {
				return;
			}
			if (this.trackingSessionStop) {
				this.trackingSessionStop(true);
			} else {
				this.stop(true);
			}
			this.windows.sendPreferences();
		}, delayMs);
	}
}
