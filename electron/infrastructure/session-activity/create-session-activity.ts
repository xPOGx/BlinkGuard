import type {
	SessionActivityPort,
	SessionActivitySnapshot,
} from "../../application/ports/session-activity-port";
import { MacosSessionActivity } from "./macos-session-activity";
import { StubSessionActivity } from "./stub-session-activity";
import { WindowsSessionActivity } from "./windows-session-activity";

export function createSessionActivity(
	onChange: (snapshot: SessionActivitySnapshot) => void,
	platform: NodeJS.Platform = process.platform,
): SessionActivityPort {
	if (platform === "win32") return new WindowsSessionActivity(onChange);
	if (platform === "darwin") return new MacosSessionActivity(onChange);
	return new StubSessionActivity();
}
