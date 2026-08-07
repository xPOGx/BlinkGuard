import type { FocusEnvironmentPort } from "../../application/ports/focus-environment-port";

/** Non-Windows / unavailable detector — never reports fullscreen. */
export class StubFocusEnvironment implements FocusEnvironmentPort {
	isOtherAppFullscreen(): boolean {
		return false;
	}
}
