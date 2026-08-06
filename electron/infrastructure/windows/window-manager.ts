import { BrowserWindow, screen } from "electron";
import path from "node:path";
import type { AppPreferences, Point, Size } from "../../../shared/preferences";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import { toRendererPreferences } from "../../../shared/preferences";
import type { AppPaths } from "../paths/app-paths";
import { createPanelWindow } from "./panel-window";
import {
	getCenteredPopupPosition,
	getTopCenterPopupPosition,
} from "./window-position";

type ReminderKind = "starting" | "blink" | "stopped";
export class WindowManager {
	main: BrowserWindow | null = null;
	reminder: BrowserWindow | null = null;
	exercise: BrowserWindow | null = null;
	camera: BrowserWindow | null = null;
	editor: BrowserWindow | null = null;
	noFace: BrowserWindow | null = null;

	constructor(
		private readonly paths: AppPaths,
		private readonly preferences: AppPreferences,
		private readonly devServerUrl: string | undefined,
	) {}

	createMain(onClose: (event: Electron.Event) => void): BrowserWindow {
		const window = new BrowserWindow({
			width: 900,
			height: 640,
			minWidth: 720,
			minHeight: 520,
			icon: path.join(this.paths.publicDir, "electron-vite.svg"),
			autoHideMenuBar: true,
			webPreferences: {
				preload: this.paths.preload,
				nodeIntegration: false,
				contextIsolation: true,
				webSecurity: true,
			},
		});
		this.main = window;
		window.on("close", onClose);
		window.webContents.on("did-finish-load", () => {
			this.sendToMain(
				IPC_CHANNELS.mainProcessMessage,
				new Date().toLocaleString(),
			);
			this.sendPreferences();
		});
		if (this.devServerUrl) {
			void window.loadURL(this.devServerUrl);
		} else {
			void window.loadFile(path.join(this.paths.rendererDist, "index.html"));
		}
		return window;
	}

	activateMain(onClose: (event: Electron.Event) => void): void {
		if (this.main && !this.main.isDestroyed()) {
			if (!this.main.isVisible()) this.main.show();
			this.main.focus();
			return;
		}
		if (BrowserWindow.getAllWindows().length === 0) this.createMain(onClose);
	}

	showMain(): void {
		if (this.main && !this.main.isDestroyed()) {
			this.main.show();
			this.main.focus();
		}
	}

	sendToMain(channel: string, ...args: unknown[]): void {
		if (this.main && !this.main.isDestroyed()) {
			this.main.webContents.send(channel, ...args);
		}
	}

	sendPreferences(): void {
		this.sendToMain(
			IPC_CHANNELS.loadPreferences,
			toRendererPreferences(this.preferences),
		);
	}

	showReminder(kind: ReminderKind): BrowserWindow | null {
		if (kind !== "stopped" && !this.preferences.isTracking) return null;
		this.closeReminder();
		const position = this.ensurePopupPosition();
		const popup = createPanelWindow({
			width: this.preferences.popupSize.width,
			height: this.preferences.popupSize.height,
			x: position.x,
			y: position.y,
			focusable: false,
		}, this.paths.preload);
		popup.setOpacity(1 - this.preferences.popupColors.transparency);
		this.reminder = popup;
		void popup.loadFile(path.join(this.paths.publicDir, `${kind}.html`));
		popup.webContents.on("did-finish-load", () => {
			popup.webContents.send(
				IPC_CHANNELS.updateColors,
				this.preferences.popupColors,
			);
			if (kind === "blink") {
				popup.webContents.send(
					IPC_CHANNELS.updateMessage,
					this.preferences.popupMessage,
				);
				popup.webContents.send(
					IPC_CHANNELS.cameraMode,
					this.preferences.cameraEnabled,
				);
			}
			popup.setIgnoreMouseEvents(true);
		});
		popup.once("ready-to-show", () => popup.showInactive());
		popup.on("closed", () => {
			if (this.reminder === popup) this.reminder = null;
		});
		if (
			kind === "stopped" ||
			(kind === "blink" && !this.preferences.cameraEnabled)
		) {
			setTimeout(() => this.closeReminderIfCurrent(popup), 2500);
		}
		return popup;
	}

	closeReminder(): void {
		this.closeWindow("reminder");
	}

	closeReminderIfCurrent(token: unknown): boolean {
		if (this.reminder !== token) return false;
		this.closeReminder();
		return true;
	}

	hasReminder(): boolean {
		return !!this.reminder && !this.reminder.isDestroyed();
	}

	showNoFace(): void {
		if (
			!this.preferences.isTracking ||
			!this.preferences.cameraEnabled ||
			(this.noFace && !this.noFace.isDestroyed())
		) {
			return;
		}
		const { x, y } = getTopCenterPopupPosition(220);
		const popup = createPanelWindow({
			width: 220,
			height: 48,
			x,
			y,
			focusable: false,
		}, this.paths.preload);
		this.noFace = popup;
		void popup.loadFile(path.join(this.paths.publicDir, "no-face.html"));
		popup.webContents.on("did-finish-load", () => popup.setIgnoreMouseEvents(true));
		popup.once("ready-to-show", () => popup.showInactive());
		popup.on("closed", () => {
			if (this.noFace === popup) this.noFace = null;
		});
	}

	hideNoFace(): void {
		this.closeWindow("noFace");
	}

	hasNoFace(): boolean {
		return !!this.noFace && !this.noFace.isDestroyed();
	}

	showExercise(onClosed: () => void): BrowserWindow | null {
		if (this.exercise && !this.exercise.isDestroyed()) return null;
		const { width, height } = screen.getPrimaryDisplay().workAreaSize;
		const popupWidth = 340;
		const popupHeight = 200;
		const popup = createPanelWindow({
			width: popupWidth,
			height: popupHeight,
			x: Math.floor((width - popupWidth) / 2),
			y: Math.floor((height - popupHeight) / 2),
			focusable: true,
		}, this.paths.preload);
		this.exercise = popup;
		void popup.loadFile(path.join(this.paths.publicDir, "exercise.html"));
		popup.once("ready-to-show", () => popup.show());
		popup.on("closed", () => {
			if (this.exercise === popup) this.exercise = null;
			onClosed();
		});
		return popup;
	}

	closeExercise(): void {
		this.closeWindow("exercise");
	}

	closeExerciseIfCurrent(token: unknown): boolean {
		if (this.exercise !== token) return false;
		this.closeExercise();
		return true;
	}

	showCamera(onClosed: () => void): BrowserWindow {
		if (this.camera && !this.camera.isDestroyed()) {
			this.camera.focus();
			return this.camera;
		}
		const { width, height } = screen.getPrimaryDisplay().workAreaSize;
		const window = new BrowserWindow({
			width: Math.min(640, width * 0.8),
			height: Math.min(480, height * 0.8),
			title: "Camera Visualization",
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				preload: this.paths.preload,
			},
		});
		this.camera = window;
		void window.loadFile(path.join(this.paths.publicDir, "camera.html"));
		window.on("close", onClosed);
		window.on("closed", () => {
			if (this.camera === window) this.camera = null;
			onClosed();
		});
		return window;
	}

	closeCamera(): void {
		this.closeWindow("camera");
	}

	sendToCamera(channel: string, ...args: unknown[]): void {
		if (this.camera && !this.camera.isDestroyed()) {
			this.camera.webContents.send(channel, ...args);
		}
	}

	showEditor(): BrowserWindow {
		if (this.editor && !this.editor.isDestroyed()) {
			this.editor.focus();
			return this.editor;
		}
		const position = this.ensurePopupPosition();
		const window = createPanelWindow({
			width: this.preferences.popupSize.width,
			height: this.preferences.popupSize.height,
			x: position.x,
			y: position.y,
			focusable: true,
			resizable: true,
			minWidth: 200,
			minHeight: 80,
		}, this.paths.preload);
		this.editor = window;
		window.setOpacity(1 - this.preferences.popupColors.transparency);
		void window.loadFile(path.join(this.paths.publicDir, "popup-editor.html"));
		window.webContents.on("did-finish-load", () => {
			window.webContents.send(
				IPC_CHANNELS.updateColors,
				this.preferences.popupColors,
			);
			window.webContents.send(IPC_CHANNELS.currentPopupState, {
				size: this.preferences.popupSize,
				position: this.preferences.popupPosition,
			});
		});
		window.once("ready-to-show", () => window.show());
		window.on("closed", () => {
			if (this.editor === window) this.editor = null;
		});
		return window;
	}

	applyPopupAppearance(): void {
		for (const window of [this.reminder, this.editor]) {
			if (window && !window.isDestroyed()) {
				window.setOpacity(1 - this.preferences.popupColors.transparency);
			}
		}
	}

	applyPopupGeometry(size: Size, position: Point): void {
		if (this.reminder && !this.reminder.isDestroyed()) {
			this.reminder.setSize(size.width, size.height);
			this.reminder.setPosition(position.x, position.y);
		}
	}

	destroyAll(): void {
		for (const window of BrowserWindow.getAllWindows()) {
			if (!window.isDestroyed()) window.destroy();
		}
		this.main = null;
		this.reminder = null;
		this.exercise = null;
		this.camera = null;
		this.editor = null;
		this.noFace = null;
	}

	private ensurePopupPosition(): Point {
		if (!this.preferences.popupPosition) {
			this.preferences.popupPosition = getCenteredPopupPosition(300, 120);
		}
		return this.preferences.popupPosition;
	}

	private closeWindow(
		key: "reminder" | "exercise" | "camera" | "editor" | "noFace",
	): void {
		const window = this[key];
		if (window && !window.isDestroyed()) window.close();
		this[key] = null;
	}
}
