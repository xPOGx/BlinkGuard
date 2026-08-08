export interface FocusEnvironmentPort {
	/** True when a non-BlinkGuard foreground window covers nearly an entire display. */
	isOtherAppFullscreen(): boolean;
	/** False on platforms without a real fullscreen probe (e.g. Linux stub). */
	supportsFullscreenDetection(): boolean;
}
