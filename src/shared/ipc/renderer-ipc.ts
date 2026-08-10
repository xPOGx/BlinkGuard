import type { AutoUpdateStatus } from "../../../shared/auto-update";
import type {
	BackupScope,
	ExportBackupResult,
	ImportBackupResult,
} from "../../../shared/backup";
import type { BlinkStatsSnapshot } from "../../../shared/blink-stats";
import type {
	DebugOverlayKind,
	DebugSoundKind,
} from "../../../shared/debug-preview";
import type { ExportDiagnosticsResult } from "../../../shared/diagnostics";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import type {
	CameraQuality,
	PopupColors,
	RendererPreferences,
} from "../../../shared/preferences";
import type { ExportProfileImageResult } from "../../../shared/profile-export";
import type { GetReleaseNotesResult } from "../../../shared/release-notes";

type Listener = (...args: unknown[]) => void;

interface RendererBridge {
	on(channel: string, listener: Listener): void;
	off(channel: string, listener: Listener): void;
	send(channel: string, ...args: unknown[]): void;
	invoke(channel: string, ...args: unknown[]): Promise<unknown>;
}

const bridge = (): RendererBridge | undefined =>
	window.ipcRenderer as unknown as RendererBridge | undefined;

const send = (channel: string, ...args: unknown[]) => {
	bridge()?.send(channel, ...args);
};

const subscribe = <T>(
	channel: string,
	listener: (payload: T) => void,
): (() => void) => {
	const wrapped: Listener = (payload) => listener(payload as T);
	bridge()?.on(channel, wrapped);
	return () => bridge()?.off(channel, wrapped);
};

export const rendererIpc = {
	onPreferences: (listener: (preferences: RendererPreferences) => void) =>
		subscribe(IPC_CHANNELS.loadPreferences, listener),
	onCameraError: (listener: (error: string) => void) =>
		subscribe(IPC_CHANNELS.cameraError, listener),
	onCameraReady: (listener: () => void) =>
		subscribe(IPC_CHANNELS.cameraReady, listener),
	onShortcutError: (listener: (shortcut: string | null) => void) =>
		subscribe(IPC_CHANNELS.shortcutError, listener),
	onCameraWindowClosed: (listener: () => void) =>
		subscribe(IPC_CHANNELS.cameraWindowClosed, listener),

	startReminders: (intervalSeconds: number) =>
		send(IPC_CHANNELS.startBlinkReminders, intervalSeconds * 1000),
	stopReminders: () => send(IPC_CHANNELS.stopBlinkReminders),
	/** Settings shell hydrated + boot splash dismissed — main may restore tracking. */
	notifyShellReady: () => send(IPC_CHANNELS.shellReady),
	updateReminderInterval: (intervalSeconds: number) =>
		send(IPC_CHANNELS.updateInterval, intervalSeconds * 1000),
	updateDarkMode: (enabled: boolean) =>
		send(IPC_CHANNELS.updateDarkMode, enabled),
	updateCameraEnabled: (enabled: boolean) =>
		send(IPC_CHANNELS.updateCameraEnabled, enabled),
	updateCameraQuality: (quality: CameraQuality) =>
		send(IPC_CHANNELS.updateCameraQuality, quality),
	updateAutoStopNoFaceEnabled: (enabled: boolean) =>
		send(IPC_CHANNELS.updateAutoStopNoFaceEnabled, enabled),
	updateAutoStopNoFaceMinutes: (minutes: number) =>
		send(IPC_CHANNELS.updateAutoStopNoFaceMinutes, minutes),
	updateSnoozeMinutes: (minutes: number) =>
		send(IPC_CHANNELS.updateSnoozeMinutes, minutes),
	updateEarCalibration: (baseline: number | null) =>
		send(IPC_CHANNELS.updateEarCalibration, baseline),
	startEarCalibration: () => send(IPC_CHANNELS.startEarCalibration),
	cancelEarCalibration: () => send(IPC_CHANNELS.cancelEarCalibration),
	onEarCalibrationProgress: (
		listener: (payload: {
			elapsedMs: number;
			sampleCount: number;
			durationMs: number;
			faceDetected: boolean;
		}) => void,
	) => subscribe(IPC_CHANNELS.earCalibrationProgress, listener),
	onEarCalibrationComplete: (
		listener: (payload: { baseline: number | null; error?: string }) => void,
	) => subscribe(IPC_CHANNELS.earCalibrationComplete, listener),
	updateEyeExercisesEnabled: (enabled: boolean) =>
		send(IPC_CHANNELS.updateEyeExercisesEnabled, enabled),
	updateExerciseInterval: (minutes: number) =>
		send(IPC_CHANNELS.updateExerciseInterval, minutes),
	updateExercisePrompts: (prompts: string[]) =>
		send(IPC_CHANNELS.updateExercisePrompts, prompts),
	updateEyeCareIndependentOfTracking: (enabled: boolean) =>
		send(IPC_CHANNELS.updateEyeCareIndependentOfTracking, enabled),
	updateLookAwayEnabled: (enabled: boolean) =>
		send(IPC_CHANNELS.updateLookAwayEnabled, enabled),
	updateLookAwayInterval: (minutes: number) =>
		send(IPC_CHANNELS.updateLookAwayInterval, minutes),
	updateLookAwayDuration: (seconds: number) =>
		send(IPC_CHANNELS.updateLookAwayDuration, seconds),
	updateLookAwayTitle: (title: string) =>
		send(IPC_CHANNELS.updateLookAwayTitle, title),
	updateLookAwayHint: (hint: string) =>
		send(IPC_CHANNELS.updateLookAwayHint, hint),
	updatePopupColors: (colors: PopupColors) =>
		send(IPC_CHANNELS.updatePopupColors, colors),
	updatePopupTransparency: (transparency: number) =>
		send(IPC_CHANNELS.updatePopupTransparency, transparency),
	updatePopupMessage: (message: string) =>
		send(IPC_CHANNELS.updatePopupMessage, message),
	updateBlinkPopupClickThrough: (enabled: boolean) =>
		send(IPC_CHANNELS.updateBlinkPopupClickThrough, enabled),
	updateKeyboardShortcut: (shortcut: string) =>
		send(IPC_CHANNELS.updateKeyboardShortcut, shortcut),
	updateSoundEnabled: (enabled: boolean) =>
		send(IPC_CHANNELS.updateSoundEnabled, enabled),
	updateSoundVolume: (volume: number) =>
		send(IPC_CHANNELS.updateSoundVolume, volume),
	updateLaunchAtLogin: (enabled: boolean) =>
		send(IPC_CHANNELS.updateLaunchAtLogin, enabled),
	updateHasCompletedOnboarding: (completed: boolean) =>
		send(IPC_CHANNELS.updateHasCompletedOnboarding, completed),
	updateQuietHoursEnabled: (enabled: boolean) =>
		send(IPC_CHANNELS.updateQuietHoursEnabled, enabled),
	updateQuietHoursStart: (value: string) =>
		send(IPC_CHANNELS.updateQuietHoursStart, value),
	updateQuietHoursEnd: (value: string) =>
		send(IPC_CHANNELS.updateQuietHoursEnd, value),
	updatePauseOnFullscreen: (enabled: boolean) =>
		send(IPC_CHANNELS.updatePauseOnFullscreen, enabled),
	updateBlinkRateCoachingEnabled: (enabled: boolean) =>
		send(IPC_CHANNELS.updateBlinkRateCoachingEnabled, enabled),
	updateBlinkRateThreshold: (threshold: number) =>
		send(IPC_CHANNELS.updateBlinkRateThreshold, threshold),
	updateLocale: (locale: string) => send(IPC_CHANNELS.updateLocale, locale),
	onFocusPauseState: (
		listener: (payload: {
			reason: "quiet-hours" | "fullscreen" | null;
			fullscreenDetectionSupported: boolean;
		}) => void,
	) => subscribe(IPC_CHANNELS.focusPauseState, listener),
	updateMgdMode: (enabled: boolean) =>
		send(IPC_CHANNELS.updateMgdMode, enabled),
	startCameraTracking: () => send(IPC_CHANNELS.startCameraTracking),
	stopCameraTracking: () => send(IPC_CHANNELS.stopCameraTracking),
	showCameraWindow: () => send(IPC_CHANNELS.showCameraWindow),
	closeCameraWindow: () => send(IPC_CHANNELS.closeCameraWindow),
	showPopupEditor: () => send(IPC_CHANNELS.showPopupEditor),
	resetPreferences: (replayOnboarding = false) =>
		send(IPC_CHANNELS.resetPreferences, replayOnboarding),
	onBlinkStats: (listener: (snapshot: BlinkStatsSnapshot) => void) =>
		subscribe(IPC_CHANNELS.loadBlinkStats, listener),
	requestBlinkStats: () => send(IPC_CHANNELS.requestBlinkStats),
	subscribeBlinkStats: () => send(IPC_CHANNELS.subscribeBlinkStats),
	unsubscribeBlinkStats: () => send(IPC_CHANNELS.unsubscribeBlinkStats),
	resetBlinkStats: () => send(IPC_CHANNELS.resetBlinkStats),
	spendBlinkReward: (rewardId: string) =>
		send(IPC_CHANNELS.spendBlinkReward, rewardId),
	updateGoalsConfig: (config: {
		goalsEnabled: boolean;
		dailyBlinkGoal: number;
		dailyTrackingMinutesGoal: number;
		weeklyBlinkGoal: number;
		weeklyTrackingMinutesGoal: number;
	}) => send(IPC_CHANNELS.updateGoalsConfig, config),
	debugPreviewOverlay: (kind: DebugOverlayKind) =>
		send(IPC_CHANNELS.debugPreviewOverlay, kind),
	debugPreviewSound: (kind: DebugSoundKind, volume?: number) =>
		send(IPC_CHANNELS.debugPreviewSound, kind, volume),
	debugPreviewCheer: () => send(IPC_CHANNELS.debugPreviewCheer),
	debugPreviewLevelUp: (level?: number) =>
		send(IPC_CHANNELS.debugPreviewLevelUp, level),
	debugSetProfileLevel: (level: number, celebrate = false) =>
		send(IPC_CHANNELS.debugSetProfileLevel, level, celebrate),
	debugSetShopReward: (
		rewardId: "statsFlair" | "streakShield",
		enabled: boolean,
	) => send(IPC_CHANNELS.debugSetShopReward, rewardId, enabled),
	debugSetShopDiscountLevel: (level: number) =>
		send(IPC_CHANNELS.debugSetShopDiscountLevel, level),
	openGithubRepo: () => send(IPC_CHANNELS.openGithubRepo),
	openGithubReleases: () => send(IPC_CHANNELS.openGithubReleases),
	openExternalUrl: (url: string) => send(IPC_CHANNELS.openExternalUrl, url),
	checkForUpdates: () => send(IPC_CHANNELS.checkForUpdates),
	installUpdate: () => send(IPC_CHANNELS.installUpdate),
	onAutoUpdateStatus: (listener: (status: AutoUpdateStatus) => void) =>
		subscribe(IPC_CHANNELS.autoUpdateStatus, listener),
	getReleaseNotes: async (): Promise<GetReleaseNotesResult> => {
		const result = await bridge()?.invoke(IPC_CHANNELS.getReleaseNotes);
		if (
			result &&
			typeof result === "object" &&
			"status" in result &&
			((result as GetReleaseNotesResult).status === "ok" ||
				(result as GetReleaseNotesResult).status === "error")
		) {
			return result as GetReleaseNotesResult;
		}
		return {
			status: "error",
			message: "Release notes are unavailable in this environment",
		};
	},
	exportDiagnostics: async (): Promise<ExportDiagnosticsResult> => {
		const result = await bridge()?.invoke(IPC_CHANNELS.exportDiagnostics);
		if (
			result &&
			typeof result === "object" &&
			"status" in result &&
			(result as ExportDiagnosticsResult).status
		) {
			return result as ExportDiagnosticsResult;
		}
		return {
			status: "error",
			message: "Diagnostics export is unavailable in this environment",
		};
	},
	exportProfileImage: async (
		pngBytes: Uint8Array,
	): Promise<ExportProfileImageResult> => {
		const result = await bridge()?.invoke(
			IPC_CHANNELS.exportProfileImage,
			pngBytes,
		);
		if (
			result &&
			typeof result === "object" &&
			"status" in result &&
			(result as ExportProfileImageResult).status
		) {
			return result as ExportProfileImageResult;
		}
		return {
			status: "error",
			message: "Profile image export is unavailable in this environment",
		};
	},
	exportBackup: async (scope: BackupScope): Promise<ExportBackupResult> => {
		const result = await bridge()?.invoke(IPC_CHANNELS.exportBackup, scope);
		if (
			result &&
			typeof result === "object" &&
			"status" in result &&
			(result as ExportBackupResult).status
		) {
			return result as ExportBackupResult;
		}
		return {
			status: "error",
			message: "Backup export is unavailable in this environment",
		};
	},
	importBackup: async (scope: BackupScope): Promise<ImportBackupResult> => {
		const result = await bridge()?.invoke(IPC_CHANNELS.importBackup, scope);
		if (
			result &&
			typeof result === "object" &&
			"status" in result &&
			(result as ImportBackupResult).status
		) {
			return result as ImportBackupResult;
		}
		return {
			status: "error",
			message: "Backup import is unavailable in this environment",
		};
	},
};
