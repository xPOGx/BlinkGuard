import type { FocusEnvironmentPort } from "../../application/ports/focus-environment-port";
import { MacosFullscreenDetector } from "./macos-fullscreen-detector";
import { StubFocusEnvironment } from "./stub-focus-environment";
import { WindowsFullscreenDetector } from "./windows-fullscreen-detector";

export function createFocusEnvironment(
	platform: NodeJS.Platform = process.platform,
): FocusEnvironmentPort & {
	dispose?: () => void;
} {
	if (platform === "win32") {
		return new WindowsFullscreenDetector();
	}
	if (platform === "darwin") {
		return new MacosFullscreenDetector();
	}
	return new StubFocusEnvironment();
}
