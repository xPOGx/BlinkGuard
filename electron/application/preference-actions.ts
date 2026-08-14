import type { ParsedBackup } from "../../shared/backup";
import {
	backupScopeIncludesPreferences,
	backupScopeIncludesStatistics,
	type BackupScope,
} from "../../shared/backup";
import { sanitizeLocale, type Locale } from "../../shared/i18n";
import { IPC_CHANNELS } from "../../shared/ipc-channels";
import type { ClassifierCalibrationPayload } from "../../shared/classifier-calibration";
import type { CameraDevicePref } from "../../shared/camera-devices";
import type {
	CameraQuality,
	KeyboardShortcuts,
} from "../../shared/preferences";
import type { BlinkStatsService } from "./blink-stats-service";
import type { ExerciseService } from "./exercise-service";
import type { FocusPauseService } from "./focus-pause-service";
import type { LookAwayService } from "./look-away-service";
import type { PreferencesService } from "./preferences-service";
import type { ReminderService } from "./reminder-service";

/** Sidecar subset used by preference multi-step flows (avoids infra import). */
export interface PreferenceActionSidecar {
	startEarCalibration(): void;
	cancelEarCalibration(reason?: string): void;
	applyCameraQuality(quality?: CameraQuality): void;
	applyCameraDevice(device?: CameraDevicePref | null): void;
	applyEarCalibration(baseline?: number | null): void;
	applyClassifierCalibration(
		payload?: ClassifierCalibrationPayload | null,
	): void;
}

export interface PreferenceActionWindows {
	sendPreferences(): void;
	sendToMain(channel: string, ...args: unknown[]): void;
	showCamera(onClosed: () => void): void;
}

export interface PreferenceActionShortcuts {
	registerAll(shortcuts: KeyboardShortcuts): void;
}

export interface PreferenceActionTray {
	rebuildMenu(locale?: Locale): void;
}

/**
 * Multi-step preference workflows that used to live in IPC handlers.
 * Keeps register-ipc-handlers as thin dispatch.
 */
export class PreferenceActions {
	constructor(
		private readonly preferences: PreferencesService,
		private readonly reminders: ReminderService,
		private readonly exercises: ExerciseService,
		private readonly lookAway: LookAwayService,
		private readonly focusPause: FocusPauseService,
		private readonly blinkStats: BlinkStatsService,
		private readonly windows: PreferenceActionWindows,
		private readonly sidecar: PreferenceActionSidecar,
		private readonly shortcuts: PreferenceActionShortcuts,
		private readonly applyLaunchAtLogin: (enabled: boolean) => void,
		private readonly tray?: PreferenceActionTray,
	) {}

	startEarCalibration(): void {
		if (!this.preferences.current.cameraEnabled) {
			this.preferences.set("cameraEnabled", true);
		}
		this.reminders.ensureCameraActive();
		this.sidecar.startEarCalibration();
	}

	updateLocale(value: string): void {
		const locale = sanitizeLocale(value);
		// Same locale is a no-op. Never rewrite popup/exercise content here —
		// React LanguageSettings owns built-in prompt updates; sendPreferences
		// + prompt rewrite used to bounce the settings sync forever.
		if (locale === this.preferences.current.locale) return;
		this.preferences.set("locale", locale);
		this.tray?.rebuildMenu(locale);
		this.blinkStats.invalidateCharts();
		this.windows.sendPreferences();
		if (this.blinkStats.isLivePushEnabled()) {
			this.windows.sendToMain(
				IPC_CHANNELS.loadBlinkStats,
				this.blinkStats.getSnapshot(),
			);
		}
	}

	showCameraWindow(): void {
		const enabledCamera = !this.preferences.current.cameraEnabled;
		if (enabledCamera) {
			this.preferences.set("cameraEnabled", true);
		}
		this.reminders.ensureCameraActive();
		// Only echo when main mutated prefs; unconditional sendPreferences
		// is a bounce vector for the React sync effect.
		if (enabledCamera) {
			this.windows.sendPreferences();
		}
		this.windows.showCamera(() => {
			this.windows.sendToMain(IPC_CHANNELS.cameraWindowClosed);
			this.reminders.stopCameraIfIdle();
		});
	}

	resetPreferences(replayOnboarding?: boolean): void {
		const current = this.preferences.current;
		if (current.isTracking) this.reminders.stop(true);
		this.exercises.stop();
		this.lookAway.stop();
		this.sidecar.cancelEarCalibration("Preferences reset");
		this.preferences.reset(null, {
			replayOnboarding: Boolean(replayOnboarding),
		});
		this.applyLaunchAtLogin(false);
		this.shortcuts.registerAll(this.preferences.current.keyboardShortcuts);
		this.sidecar.applyCameraQuality(this.preferences.current.cameraQuality);
		this.sidecar.applyCameraDevice(this.preferences.current.cameraDevice);
		this.sidecar.applyEarCalibration(null);
		this.sidecar.applyClassifierCalibration(null);
		this.tray?.rebuildMenu(this.preferences.current.locale);
		this.windows.sendPreferences();
		this.focusPause.recompute();
	}

	/**
	 * Apply a validated backup payload. Replace only the requested scope.
	 * Single sendPreferences echo when prefs change (avoid sync bounce).
	 */
	applyBackup(scope: BackupScope, parsed: ParsedBackup): void {
		const applyPrefs =
			backupScopeIncludesPreferences(scope) && parsed.preferences;
		const applyStats =
			backupScopeIncludesStatistics(scope) && parsed.blinkStats;

		if (applyPrefs && parsed.preferences) {
			const current = this.preferences.current;
			if (current.isTracking) this.reminders.stop(true);
			this.exercises.stop();
			this.lookAway.stop();
			this.sidecar.cancelEarCalibration("Preferences imported from backup");
			this.preferences.replaceFromBackup(parsed.preferences);
			const next = this.preferences.current;
			this.applyLaunchAtLogin(next.launchAtLogin);
			this.shortcuts.registerAll(next.keyboardShortcuts);
			this.sidecar.applyCameraQuality(next.cameraQuality);
			this.sidecar.applyCameraDevice(next.cameraDevice);
			this.sidecar.applyEarCalibration(next.earCalibration);
			this.sidecar.applyClassifierCalibration({
				bias: next.classifierBias,
				threshold: next.classifierThreshold,
			});
			this.tray?.rebuildMenu(next.locale);
			this.blinkStats.invalidateCharts();
			this.windows.sendPreferences();
			this.focusPause.recompute();
		}

		if (applyStats && parsed.blinkStats) {
			this.blinkStats.replaceState(parsed.blinkStats);
			if (this.blinkStats.isLivePushEnabled()) {
				this.windows.sendToMain(
					IPC_CHANNELS.loadBlinkStats,
					this.blinkStats.getSnapshot(),
				);
			}
		} else if (applyPrefs) {
			this.blinkStats.reconcileAchievements({ celebrate: "summary" });
			if (this.blinkStats.isLivePushEnabled()) {
				this.windows.sendToMain(
					IPC_CHANNELS.loadBlinkStats,
					this.blinkStats.getSnapshot(),
				);
			}
		}
	}
}
