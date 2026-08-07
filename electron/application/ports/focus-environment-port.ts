export interface FocusEnvironmentPort {
	/** True when a non-BlinkGuard foreground window covers nearly an entire display. */
	isOtherAppFullscreen(): boolean;
}
