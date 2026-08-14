import type { SessionActivityPort } from "../../application/ports/session-activity-port";

/** Unsupported platform — lock/suspend still come from Electron powerMonitor. */
export class StubSessionActivity implements SessionActivityPort {
	start(): void {}
	dispose(): void {}
}
