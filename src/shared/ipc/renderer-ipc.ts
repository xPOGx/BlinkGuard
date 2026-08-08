import type { BlinkStatsSnapshot } from "../../../shared/blink-stats";
import type {
	DebugOverlayKind,
	DebugSoundKind,
} from "../../../shared/debug-preview";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import type {
	CameraQuality,
	PopupColors,
	RendererPreferences,
} from "../../../shared/preferences";

type Listener = (...args: unknown[]) => void;

interface RendererBridge {
	on(channel: string, listener: Listener): void;
	off(channel: string, listener: Listener): void;
	send(channel: string, ...args: unknown[]): void;
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
	onShortcutError: (listener: (shortcut: string | null) => void) =>
		subscribe(IPC_CHANNELS.shortcutError, listener),
	onCameraWindowClosed: (listener: () => void) =>
		subscribe(IPC_CHANNELS.cameraWindowClosed, listener),

	startReminders: (intervalSeconds: number) =>
		send(IPC_CHANNELS.startBlinkReminders, intervalSeconds * 1000),
	stopReminders: () => send(IPC_CHANNELS.stopBlinkReminders),
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
	updateEarCalibration: (baseline: number | null) =>
		send(IPC_CHANNELS.updateEarCalibration, baseline),
	startEarCalibration: () => send(IPC_CHANNELS.startEarCalibration),
	cancelEarCalibration: () => send(IPC_CHANNELS.cancelEarCalibration),
	onEarCalibrationProgress: (
		listener: (payload: {
			elapsedMs: number;
			sampleCount: number;
			durationMs: number;
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
	updateLookAwayEnabled: (enabled: boolean) =>
		send(IPC_CHANNELS.updateLookAwayEnabled, enabled),
	updateLookAwayInterval: (minutes: number) =>
		send(IPC_CHANNELS.updateLookAwayInterval, minutes),
	updateLookAwayDuration: (seconds: number) =>
		send(IPC_CHANNELS.updateLookAwayDuration, seconds),
	updatePopupColors: (colors: PopupColors) =>
		send(IPC_CHANNELS.updatePopupColors, colors),
	updatePopupTransparency: (transparency: number) =>
		send(IPC_CHANNELS.updatePopupTransparency, transparency),
	updatePopupMessage: (message: string) =>
		send(IPC_CHANNELS.updatePopupMessage, message),
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
	debugPreviewOverlay: (kind: DebugOverlayKind) =>
		send(IPC_CHANNELS.debugPreviewOverlay, kind),
	debugPreviewSound: (kind: DebugSoundKind, volume?: number) =>
		send(IPC_CHANNELS.debugPreviewSound, kind, volume),
	openGithubRepo: () => send(IPC_CHANNELS.openGithubRepo),
	checkForUpdates: () => send(IPC_CHANNELS.checkForUpdates),
};
