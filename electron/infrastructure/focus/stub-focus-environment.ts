import type {
	FocusEnvironmentPort,
	FocusForegroundSnapshot,
} from "../../application/ports/focus-environment-port";
import { EMPTY_FOREGROUND_SNAPSHOT } from "../../application/ports/focus-environment-port";
import type { PauseAppRule } from "../../../shared/preferences";

/** Unsupported platform detector — never reports fullscreen or identity. */
export class StubFocusEnvironment implements FocusEnvironmentPort {
	isOtherAppFullscreen(): boolean {
		return false;
	}

	probeForeground(): FocusForegroundSnapshot {
		return EMPTY_FOREGROUND_SNAPSHOT;
	}

	async listRunningApps(): Promise<PauseAppRule[]> {
		return [];
	}

	supportsFullscreenDetection(): boolean {
		return false;
	}
}
