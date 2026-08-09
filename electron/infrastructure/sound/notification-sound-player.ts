import { BrowserWindow } from "electron";
import fs from "node:fs";
import path from "node:path";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import {
	sanitizeSoundVolume,
	type AppPreferences,
} from "../../../shared/preferences";
import type { AppPaths } from "../paths/app-paths";

export type NotificationSoundKind =
	| "blink"
	| "exercise"
	| "lookAway"
	| "starting"
	| "stopped"
	| "cheer";

export type PlaySoundPayload = {
	volume: number;
	path?: string;
	mode?: "file" | "cheer";
};

const SOUND_FILES: Record<Exclude<NotificationSoundKind, "cheer">, string> = {
	blink: "notification.mp3",
	exercise: "exercisePopup.mp3",
	lookAway: "lookAwayPopup.mp3",
	starting: "startingPopup.mp3",
	stopped: "stoppedPopup.mp3",
};

const CLOSE_TIMEOUT_MS: Record<NotificationSoundKind, number> = {
	blink: 3000,
	exercise: 3000,
	lookAway: 3000,
	starting: 3000,
	stopped: 3000,
	cheer: 4000,
};

export class NotificationSoundPlayer {
	constructor(
		private readonly paths: AppPaths,
		private readonly preferences: AppPreferences,
		private readonly isProd: boolean,
	) {}

	play(
		kind: NotificationSoundKind,
		options?: { force?: boolean; volume?: number },
	): void {
		if (!options?.force && !this.preferences.soundEnabled) return;

		const volumePercent =
			options?.volume !== undefined
				? sanitizeSoundVolume(options.volume)
				: this.preferences.soundVolume;
		if (volumePercent <= 0) return;

		const volume = Math.min(1, Math.max(0, volumePercent / 100));
		let payload: PlaySoundPayload;

		if (kind === "cheer") {
			payload = { mode: "cheer", volume };
		} else {
			const soundPath = this.isProd
				? path.join(
						process.resourcesPath,
						"app.asar.unpacked",
						"public",
						"sounds",
						SOUND_FILES[kind],
					)
				: path.join(this.paths.root, "public", "sounds", SOUND_FILES[kind]);

			if (!fs.existsSync(soundPath)) {
				console.warn(`Notification sound missing: ${soundPath}`);
				return;
			}

			payload = { mode: "file", path: soundPath, volume };
		}

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
			window.webContents.send(IPC_CHANNELS.playSound, payload);
		});
		window.webContents.on("ipc-message", (_event, channel) => {
			if (channel === IPC_CHANNELS.audioFinished && !window.isDestroyed()) {
				window.close();
			}
		});
		setTimeout(() => {
			if (!window.isDestroyed()) window.close();
		}, CLOSE_TIMEOUT_MS[kind]);
	}
}
