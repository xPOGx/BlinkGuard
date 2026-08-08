/**
 * Electron-free auto-update status contract for main ↔ settings renderer.
 * Do not confuse with IPC `updateMessage` (reminder popup copy).
 */
export type AutoUpdateStatus =
	| { state: "idle" }
	| { state: "checking" }
	| { state: "upToDate" }
	| { state: "available"; version: string }
	| { state: "downloading"; version: string; percent: number }
	| { state: "ready"; version: string }
	| { state: "error" }
	| { state: "unavailable" };
