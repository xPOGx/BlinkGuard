import type { FocusEnvironmentPort } from "../../application/ports/focus-environment-port";
import { StubFocusEnvironment } from "./stub-focus-environment";
import { WindowsFullscreenDetector } from "./windows-fullscreen-detector";

export function createFocusEnvironment(): FocusEnvironmentPort & {
	dispose?: () => void;
} {
	if (process.platform !== "win32") {
		return new StubFocusEnvironment();
	}
	return new WindowsFullscreenDetector();
}
