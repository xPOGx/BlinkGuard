import type { PauseAppRule } from "../../../shared/preferences";

export type FocusForegroundSnapshot = {
	isFullscreen: boolean;
	processName: string | null;
	windowTitle: string | null;
};

export const EMPTY_FOREGROUND_SNAPSHOT: FocusForegroundSnapshot = {
	isFullscreen: false,
	processName: null,
	windowTitle: null,
};

export function sameForegroundSnapshot(
	a: FocusForegroundSnapshot,
	b: FocusForegroundSnapshot,
): boolean {
	return (
		a.isFullscreen === b.isFullscreen &&
		a.processName === b.processName &&
		a.windowTitle === b.windowTitle
	);
}

export interface FocusEnvironmentPort {
	/** True when a non-BlinkGuard foreground window covers nearly an entire display. */
	isOtherAppFullscreen(): boolean;
	/** Fullscreen flag plus foreground process basename / window title. */
	probeForeground(): FocusForegroundSnapshot;
	/** Visible other-app windows for the settings picker. Never throws. */
	listRunningApps(): Promise<PauseAppRule[]>;
	/** False on platforms without a real fullscreen probe (e.g. Linux stub). */
	supportsFullscreenDetection(): boolean;
}
