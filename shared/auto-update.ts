/**
 * Electron-free auto-update status contract for main ↔ settings renderer.
 * Do not confuse with IPC `updateMessage` (reminder popup copy).
 *
 * `surface` chooses in-app UI: ephemeral top toast (silent launch check) vs
 * modal dialog (About / tray manual check). `ready` always uses the dialog.
 */
export type AutoUpdateSurface = "toast" | "dialog";

export type AutoUpdateStatus =
	| { state: "idle" }
	| { state: "checking"; surface: AutoUpdateSurface }
	| { state: "upToDate"; surface: AutoUpdateSurface }
	| { state: "available"; version: string; surface: AutoUpdateSurface }
	| {
			state: "downloading";
			version: string;
			percent: number;
			surface: AutoUpdateSurface;
	  }
	| { state: "ready"; version: string; surface: AutoUpdateSurface }
	| { state: "error"; surface: AutoUpdateSurface }
	| { state: "unavailable"; surface: AutoUpdateSurface };
