import { BrowserWindow } from "electron";
import path from "node:path";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import type { AppPreferences } from "../../../shared/preferences";
import type { AppPaths } from "../paths/app-paths";

export class NotificationSoundPlayer {
	constructor(
		private readonly paths: AppPaths,
		private readonly preferences: AppPreferences,
		private readonly isProd: boolean,
	) {}

	play(kind: "blink" | "exercise" | "stopped"): void {
		if (!this.preferences.soundEnabled) return;
		const names = {
			blink: "notification.mp3",
			exercise: "exercisePopup.mp3",
			stopped: "stoppedPopup.mp3",
		};
		const soundPath = this.isProd
			? path.join(
					process.resourcesPath,
					"app.asar.unpacked",
					"public",
					"sounds",
					names[kind],
				)
			: path.join(this.paths.root, "public", "sounds", names[kind]);
		const window = new BrowserWindow({
			width: 1,
			height: 1,
			show: false,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				preload: this.paths.preload,
			},
		});
		void window.loadFile(path.join(this.paths.publicDir, "sound-player.html"));
		window.webContents.on("did-finish-load", () => {
			window.webContents.send(IPC_CHANNELS.playSound, soundPath);
		});
		window.webContents.on("ipc-message", (_event, channel) => {
			if (channel === IPC_CHANNELS.audioFinished && !window.isDestroyed()) {
				window.close();
			}
		});
		setTimeout(() => {
			if (!window.isDestroyed()) window.close();
		}, 3000);
	}
}
