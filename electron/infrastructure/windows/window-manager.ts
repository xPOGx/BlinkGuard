import { BrowserWindow, screen } from "electron";
import path from "node:path";
import type { DebugOverlayKind } from "../../../shared/debug-preview";
import {
	resolveCatalog,
	resolveExercisePrompts,
	resolvePopupMessage,
	t,
} from "../../../shared/i18n";
import type { AppPreferences, Point, Size } from "../../../shared/preferences";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import {
	sanitizeExercisePrompts,
	toRendererPreferences,
} from "../../../shared/preferences";
import { BLINK_RATE_COACH_DISMISS_MS } from "../../domain/blink-rate-coaching";
import {
	EXERCISE_POPUP_VISIBLE_MS,
	REMINDER_POPUP_VISIBLE_MS,
} from "../../domain/reminder-policy";
import type { AppPaths } from "../paths/app-paths";
import { createPanelWindow } from "./panel-window";
import {
	getCenteredPopupPosition,
	getLeftBiasedPopupPosition,
	getRightBiasedPopupPosition,
	getTopCenterPopupPosition,
} from "./window-position";

type ReminderKind = "starting" | "blink" | "stopped";
type ForceShowOptions = { force?: boolean };
export class WindowManager {
	main: BrowserWindow | null = null;
	reminder: BrowserWindow | null = null;
	exercise: BrowserWindow | null = null;
	lookAway: BrowserWindow | null = null;
	camera: BrowserWindow | null = null;
	editor: BrowserWindow | null = null;
	noFace: BrowserWindow | null = null;
	blinkRateCoach: BrowserWindow | null = null;
	cheerToast: BrowserWindow | null = null;
	private blinkRateCoachDismissTimer: ReturnType<typeof setTimeout> | null =
		null;
	private cheerToastDismissTimer: ReturnType<typeof setTimeout> | null = null;
	private onMainLoaded: (() => void) | null = null;

	constructor(
		private readonly paths: AppPaths,
		private readonly preferences: AppPreferences,
		private readonly devServerUrl: string | undefined,
	) {}

	setOnMainLoaded(handler: (() => void) | null): void {
		this.onMainLoaded = handler;
	}

	private sendI18n(window: BrowserWindow): void {
		const locale = this.preferences.locale === "uk" ? "uk" : "en";
		window.webContents.send(IPC_CHANNELS.applyI18n, {
			locale,
			messages: resolveCatalog(locale),
		});
	}

	createMain(
		onClose: (event: Electron.Event) => void,
		options: { showOnReady?: boolean } = {},
	): BrowserWindow {
		const showOnReady = options.showOnReady ?? true;
		const window = new BrowserWindow({
			width: 1024,
			height: 768,
			minWidth: 720,
			minHeight: 520,
			show: false,
			// Match renderer boot splash / light shell background.
			backgroundColor: "#F4F7F9",
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
		window.once("ready-to-show", () => {
			if (!showOnReady || window.isDestroyed()) return;
			window.show();
		});
		window.webContents.on("did-finish-load", () => {
			this.sendToMain(
				IPC_CHANNELS.mainProcessMessage,
				new Date().toLocaleString(),
			);
			this.sendPreferences();
			this.onMainLoaded?.();
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

	showReminder(
		kind: ReminderKind,
		options: ForceShowOptions = {},
	): BrowserWindow | null {
		if (
			!options.force &&
			kind !== "stopped" &&
			!this.preferences.isTracking
		) {
			return null;
		}
		this.closeReminder();
		const position = this.ensurePopupPosition();
		const interactive = kind === "blink";
		const popup = createPanelWindow({
			width: this.preferences.popupSize.width,
			height: this.preferences.popupSize.height,
			x: position.x,
			y: position.y,
			focusable: interactive,
		}, this.paths.preload);
		popup.setOpacity(1 - this.preferences.popupColors.transparency);
		this.reminder = popup;
		void popup.loadFile(path.join(this.paths.publicDir, `${kind}.html`));
		popup.webContents.on("did-finish-load", () => {
			this.sendI18n(popup);
			popup.webContents.send(
				IPC_CHANNELS.updateColors,
				this.preferences.popupColors,
			);
			if (kind === "blink") {
				const locale =
					this.preferences.locale === "uk" ? "uk" : "en";
				popup.webContents.send(
					IPC_CHANNELS.updateMessage,
					resolvePopupMessage(this.preferences.popupMessage, locale),
				);
				popup.webContents.send(
					IPC_CHANNELS.cameraMode,
					this.preferences.cameraEnabled,
				);
			}
			if (!interactive) {
				popup.setIgnoreMouseEvents(true);
			}
		});
		popup.once("ready-to-show", () => popup.showInactive());
		popup.on("closed", () => {
			if (this.reminder === popup) this.reminder = null;
		});
		if (
			kind === "stopped" ||
			(kind === "blink" && !this.preferences.cameraEnabled)
		) {
			setTimeout(
				() => this.closeReminderIfCurrent(popup),
				REMINDER_POPUP_VISIBLE_MS,
			);
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

	showNoFace(options: ForceShowOptions = {}): void {
		if (
			!options.force &&
			(!this.preferences.isTracking ||
				!this.preferences.cameraEnabled ||
				(this.noFace && !this.noFace.isDestroyed()))
		) {
			return;
		}
		if (this.noFace && !this.noFace.isDestroyed()) {
			this.hideNoFace();
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
		popup.webContents.on("did-finish-load", () => {
			this.sendI18n(popup);
			popup.setIgnoreMouseEvents(true);
		});
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

	showBlinkRateCoach(options: ForceShowOptions = {}): void {
		if (
			!options.force &&
			(!this.preferences.isTracking ||
				!this.preferences.cameraEnabled ||
				(this.blinkRateCoach && !this.blinkRateCoach.isDestroyed()))
		) {
			return;
		}
		if (this.blinkRateCoach && !this.blinkRateCoach.isDestroyed()) {
			this.hideBlinkRateCoach();
		}
		const width = 280;
		const { x, y } = getTopCenterPopupPosition(width);
		const popup = createPanelWindow(
			{
				width,
				height: 48,
				x,
				y,
				focusable: false,
			},
			this.paths.preload,
		);
		this.blinkRateCoach = popup;
		void popup.loadFile(
			path.join(this.paths.publicDir, "blink-rate-coach.html"),
		);
		popup.webContents.on("did-finish-load", () => {
			this.sendI18n(popup);
			popup.setIgnoreMouseEvents(true);
		});
		popup.once("ready-to-show", () => popup.showInactive());
		popup.on("closed", () => {
			if (this.blinkRateCoach === popup) this.blinkRateCoach = null;
			if (this.blinkRateCoachDismissTimer) {
				clearTimeout(this.blinkRateCoachDismissTimer);
				this.blinkRateCoachDismissTimer = null;
			}
		});
		if (this.blinkRateCoachDismissTimer) {
			clearTimeout(this.blinkRateCoachDismissTimer);
		}
		this.blinkRateCoachDismissTimer = setTimeout(() => {
			this.blinkRateCoachDismissTimer = null;
			if (this.blinkRateCoach === popup) this.hideBlinkRateCoach();
		}, BLINK_RATE_COACH_DISMISS_MS);
	}

	hideBlinkRateCoach(): void {
		if (this.blinkRateCoachDismissTimer) {
			clearTimeout(this.blinkRateCoachDismissTimer);
			this.blinkRateCoachDismissTimer = null;
		}
		this.closeWindow("blinkRateCoach");
	}

	hasBlinkRateCoach(): boolean {
		return !!this.blinkRateCoach && !this.blinkRateCoach.isDestroyed();
	}

	/** Short celebration toast after spending blinks on Cheer. */
	showCheerToast(): void {
		if (this.cheerToast && !this.cheerToast.isDestroyed()) {
			this.hideCheerToast();
		}
		const width = 280;
		const { x, y } = getTopCenterPopupPosition(width);
		const popup = createPanelWindow(
			{
				width,
				height: 48,
				x,
				y,
				focusable: false,
			},
			this.paths.preload,
		);
		this.cheerToast = popup;
		void popup.loadFile(path.join(this.paths.publicDir, "cheer.html"));
		popup.webContents.on("did-finish-load", () => {
			this.sendI18n(popup);
			popup.setIgnoreMouseEvents(true);
		});
		popup.once("ready-to-show", () => popup.showInactive());
		popup.on("closed", () => {
			if (this.cheerToast === popup) this.cheerToast = null;
			if (this.cheerToastDismissTimer) {
				clearTimeout(this.cheerToastDismissTimer);
				this.cheerToastDismissTimer = null;
			}
		});
		if (this.cheerToastDismissTimer) {
			clearTimeout(this.cheerToastDismissTimer);
		}
		this.cheerToastDismissTimer = setTimeout(() => {
			this.cheerToastDismissTimer = null;
			if (this.cheerToast === popup) this.hideCheerToast();
		}, BLINK_RATE_COACH_DISMISS_MS);
	}

	hideCheerToast(): void {
		if (this.cheerToastDismissTimer) {
			clearTimeout(this.cheerToastDismissTimer);
			this.cheerToastDismissTimer = null;
		}
		this.closeWindow("cheerToast");
	}

	showExercise(prompt: string, onClosed: () => void): BrowserWindow | null {
		if (this.exercise && !this.exercise.isDestroyed()) return null;
		const popupWidth = 340;
		const popupHeight = 200;
		const { x, y } = getLeftBiasedPopupPosition(popupWidth, popupHeight);
		const popup = createPanelWindow({
			width: popupWidth,
			height: popupHeight,
			x,
			y,
			focusable: true,
		}, this.paths.preload);
		this.exercise = popup;
		void popup.loadFile(path.join(this.paths.publicDir, "exercise.html"));
		popup.webContents.on("did-finish-load", () => {
			this.sendI18n(popup);
			popup.webContents.send(IPC_CHANNELS.updateExercisePrompt, prompt);
		});
		// Same as look-away / blink: show without stealing focus.
		popup.once("ready-to-show", () => popup.showInactive());
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

	/** Dev/settings preview: show overlays without tracking / camera gates. */
	previewDebugOverlay(kind: DebugOverlayKind): void {
		switch (kind) {
			case "blink":
			case "starting":
			case "stopped": {
				const popup = this.showReminder(kind, { force: true });
				if (!popup) return;
				// Blink with camera on normally stays until a real blink; auto-dismiss for preview.
				if (
					kind === "starting" ||
					(kind === "blink" && this.preferences.cameraEnabled)
				) {
					setTimeout(
						() => this.closeReminderIfCurrent(popup),
						REMINDER_POPUP_VISIBLE_MS,
					);
				}
				return;
			}
			case "coach":
				this.showBlinkRateCoach({ force: true });
				return;
			case "noFace": {
				this.showNoFace({ force: true });
				setTimeout(() => this.hideNoFace(), 3_000);
				return;
			}
			case "exercise": {
				this.closeExercise();
				const locale =
					this.preferences.locale === "uk" ? "uk" : "en";
				const prompts = resolveExercisePrompts(
					sanitizeExercisePrompts(
						this.preferences.exercisePrompts,
						locale,
					),
					locale,
				);
				const popup = this.showExercise(
					prompts[0] ?? "Look far away",
					() => {},
				);
				if (popup) {
					setTimeout(
						() => this.closeExerciseIfCurrent(popup),
						EXERCISE_POPUP_VISIBLE_MS,
					);
				}
				return;
			}
			case "lookAway": {
				this.closeLookAway();
				const popup = this.showLookAway(() => {});
				if (popup) {
					const durationMs =
						Math.max(1, this.preferences.lookAwayDuration) * 1000;
					setTimeout(
						() => this.closeLookAwayIfCurrent(popup),
						durationMs,
					);
				}
				return;
			}
		}
	}

	showLookAway(onClosed: () => void): BrowserWindow | null {
		if (this.lookAway && !this.lookAway.isDestroyed()) return null;
		const popupWidth = 340;
		const popupHeight = 220;
		const { x, y } = getRightBiasedPopupPosition(popupWidth, popupHeight);
		const popup = createPanelWindow({
			width: popupWidth,
			height: popupHeight,
			x,
			y,
			focusable: true,
		}, this.paths.preload);
		this.lookAway = popup;
		void popup.loadFile(path.join(this.paths.publicDir, "look-away.html"), {
			query: {
				duration: String(Math.max(1, this.preferences.lookAwayDuration)),
			},
		});
		popup.webContents.on("did-finish-load", () => this.sendI18n(popup));
		// Same as blink: show without stealing focus (games / mouse capture).
		popup.once("ready-to-show", () => popup.showInactive());
		popup.on("closed", () => {
			if (this.lookAway === popup) this.lookAway = null;
			onClosed();
		});
		return popup;
	}

	closeLookAway(): void {
		this.closeWindow("lookAway");
	}

	closeLookAwayIfCurrent(token: unknown): boolean {
		if (this.lookAway !== token) return false;
		this.closeLookAway();
		return true;
	}

	showCamera(onClosed: () => void): BrowserWindow {
		if (this.camera && !this.camera.isDestroyed()) {
			this.camera.focus();
			return this.camera;
		}
		const { width, height } = screen.getPrimaryDisplay().workAreaSize;
		const locale = this.preferences.locale === "uk" ? "uk" : "en";
		const window = new BrowserWindow({
			width: Math.min(640, width * 0.8),
			height: Math.min(480, height * 0.8),
			title: t(locale, "window.cameraTitle"),
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				preload: this.paths.preload,
			},
		});
		this.camera = window;
		void window.loadFile(path.join(this.paths.publicDir, "camera.html"));
		window.webContents.on("did-finish-load", () => this.sendI18n(window));
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
			this.sendI18n(window);
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
		this.lookAway = null;
		this.camera = null;
		this.editor = null;
		this.noFace = null;
		this.blinkRateCoach = null;
		this.cheerToast = null;
	}

	private ensurePopupPosition(): Point {
		if (this.preferences.popupPosition) {
			return this.preferences.popupPosition;
		}
		const { width, height } = this.preferences.popupSize;
		return getCenteredPopupPosition(width, height);
	}

	private closeWindow(
		key:
			| "reminder"
			| "exercise"
			| "lookAway"
			| "camera"
			| "editor"
			| "noFace"
			| "blinkRateCoach"
			| "cheerToast",
	): void {
		const window = this[key];
		if (window && !window.isDestroyed()) window.close();
		this[key] = null;
	}
}
