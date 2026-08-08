import type { FocusEnvironmentPort } from "../../application/ports/focus-environment-port";

/** Unsupported platform detector — never reports fullscreen. */
export class StubFocusEnvironment implements FocusEnvironmentPort {
	isOtherAppFullscreen(): boolean {
		return false;
	}

	supportsFullscreenDetection(): boolean {
		return false;
	}
}
