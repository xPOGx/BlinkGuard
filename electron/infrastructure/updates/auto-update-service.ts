import { app, dialog } from "electron";
import electronUpdater from "electron-updater";
import type {
	AutoUpdateStatus,
	AutoUpdateSurface,
} from "../../../shared/auto-update";
import { t, type Locale } from "../../../shared/i18n";
import { hasUpdateFeed, isAutoUpdatePlatform } from "./update-feed";

// electron-updater is CJS; named ESM imports fail under Electron's ESM loader.
const { autoUpdater } = electronUpdater;

export type CheckForUpdatesOptions = {
	/** When true, use modal dialog UI and bring the main window forward. */
	interactive?: boolean;
};

export type AutoUpdateUiPort = {
	emit(status: AutoUpdateStatus): void;
	ensureVisible(): void;
	canHostInAppUi(): boolean;
};

/**
 * Windows / macOS GitHub Releases updater. Hard no-op when unpackaged,
 * unsupported platform, or when the build has no embedded feed
 * (`app-update.yml` from publish config).
 *
 * Silent launch → toast surface (ephemeral); install on quit via autoInstallOnAppQuit.
 * Manual About/tray → dialog; `ready` Restart only for interactive checks.
 */
export class AutoUpdateService {
	private enabled = false;
	private checking = false;
	private downloadedVersion: string | null = null;
	private availableVersion: string | null = null;
	/** True while an interactive (About / tray) check is in flight. */
	private interactivePending = false;

	constructor(
		private readonly getLocale: () => Locale,
		private readonly ui: AutoUpdateUiPort,
	) {}

	/** Call once after `app.whenReady`. Safe if updater cannot start. */
	start(): void {
		try {
			if (!app.isPackaged) return;
			if (!isAutoUpdatePlatform()) return;
			if (!hasUpdateFeed(process.resourcesPath)) return;

			autoUpdater.autoDownload = true;
			autoUpdater.autoInstallOnAppQuit = true;

			autoUpdater.on("error", (error) => {
				console.error("Auto-update error:", error);
				this.checking = false;
				const interactive = this.interactivePending;
				this.interactivePending = false;
				this.present(
					{ state: "error", surface: this.surfaceFor(interactive) },
					interactive,
				);
			});

			autoUpdater.on("update-not-available", () => {
				this.checking = false;
				const interactive = this.interactivePending;
				this.interactivePending = false;
				this.present(
					{ state: "upToDate", surface: this.surfaceFor(interactive) },
					interactive,
				);
			});

			autoUpdater.on("update-available", (info) => {
				this.checking = false;
				const version =
					typeof info?.version === "string" && info.version.length > 0
						? info.version
						: "…";
				this.availableVersion = version;
				const interactive = this.interactivePending;
				this.present(
					{
						state: "available",
						version,
						surface: this.surfaceFor(interactive),
					},
					interactive,
				);
			});

			autoUpdater.on("download-progress", (progress) => {
				const version = this.availableVersion ?? "…";
				const raw =
					typeof progress?.percent === "number" ? progress.percent : 0;
				const percent = Math.max(0, Math.min(100, Math.round(raw)));
				const interactive = this.interactivePending;
				this.present(
					{
						state: "downloading",
						version,
						percent,
						surface: this.surfaceFor(interactive),
					},
					interactive,
				);
			});

			autoUpdater.on("update-downloaded", (info) => {
				this.checking = false;
				const wasInteractive = this.interactivePending;
				this.interactivePending = false;
				const version =
					typeof info?.version === "string" && info.version.length > 0
						? info.version
						: (this.availableVersion ?? "…");
				this.downloadedVersion = version;
				this.availableVersion = version;
				this.presentReady(version, wasInteractive);
			});

			this.enabled = true;
		} catch (error) {
			console.error("Auto-update init failed:", error);
			this.enabled = false;
		}
	}

	/** Quiet launch check or interactive tray / About check. Never throws. */
	checkForUpdates(options: CheckForUpdatesOptions = {}): void {
		try {
			if (!this.enabled) {
				if (options.interactive) {
					this.present(
						{ state: "unavailable", surface: "dialog" },
						true,
					);
				}
				return;
			}

			if (options.interactive) {
				this.interactivePending = true;
			}

			if (this.downloadedVersion) {
				const wasInteractive = this.interactivePending;
				this.interactivePending = false;
				this.presentReady(this.downloadedVersion, wasInteractive);
				return;
			}

			const interactive = Boolean(options.interactive);
			this.present(
				{ state: "checking", surface: this.surfaceFor(interactive) },
				interactive,
			);

			if (this.checking) return;
			this.checking = true;

			void autoUpdater.checkForUpdates().catch((error) => {
				console.error("Auto-update check failed:", error);
				this.checking = false;
				const wasInteractive = this.interactivePending;
				this.interactivePending = false;
				this.present(
					{ state: "error", surface: this.surfaceFor(wasInteractive) },
					wasInteractive,
				);
			});
		} catch (error) {
			console.error("Auto-update check failed:", error);
			this.checking = false;
			if (options.interactive) {
				this.interactivePending = false;
				this.present({ state: "error", surface: "dialog" }, true);
			}
		}
	}

	/** Install a previously downloaded update (About / in-app Restart). */
	installUpdate(): void {
		if (!this.downloadedVersion) return;
		try {
			autoUpdater.quitAndInstall(false, true);
		} catch (error) {
			console.error("Auto-update install failed:", error);
			this.present({ state: "error", surface: "dialog" }, true);
		}
	}

	private surfaceFor(interactive: boolean): AutoUpdateSurface {
		return interactive ? "dialog" : "toast";
	}

	/** Interactive → Restart dialog; silent → toast (install on quit). */
	private presentReady(version: string, interactive: boolean): void {
		this.present(
			{
				state: "ready",
				version,
				surface: this.surfaceFor(interactive),
			},
			interactive,
		);
	}

	private present(status: AutoUpdateStatus, bringToFront: boolean): void {
		const shouldShow = bringToFront === true;

		if (this.ui.canHostInAppUi()) {
			if (shouldShow) {
				this.ui.ensureVisible();
			}
			this.ui.emit(status);
			return;
		}
		// Silent toast with no host: skip native dialogs (tray autostart stays quiet).
		if (
			shouldShow ||
			("surface" in status && status.surface === "dialog")
		) {
			this.showNativeFallback(status);
		}
	}

	private showNativeFallback(status: AutoUpdateStatus): void {
		const locale = this.getLocale();
		switch (status.state) {
			case "upToDate":
				void dialog.showMessageBox({
					type: "info",
					title: t(locale, "updates.upToDate.title"),
					message: t(locale, "updates.upToDate.message"),
					buttons: [t(locale, "updates.ok")],
					defaultId: 0,
					noLink: true,
				});
				return;
			case "error":
				void dialog.showMessageBox({
					type: "warning",
					title: t(locale, "updates.error.title"),
					message: t(locale, "updates.error.message"),
					buttons: [t(locale, "updates.ok")],
					defaultId: 0,
					noLink: true,
				});
				return;
			case "unavailable":
				void dialog.showMessageBox({
					type: "info",
					title: t(locale, "updates.unavailable.title"),
					message: t(locale, "updates.unavailable.message"),
					buttons: [t(locale, "updates.ok")],
					defaultId: 0,
					noLink: true,
				});
				return;
			case "ready":
				// Toast-only silent ready: no native prompt; autoInstallOnAppQuit handles it.
				if (status.surface !== "dialog") return;
				void dialog
					.showMessageBox({
						type: "info",
						title: t(locale, "updates.ready.title"),
						message: t(locale, "updates.ready.message", {
							version: status.version,
						}),
						buttons: [
							t(locale, "updates.ready.restart"),
							t(locale, "updates.ready.later"),
						],
						defaultId: 0,
						cancelId: 1,
						noLink: true,
					})
					.then(({ response }) => {
						if (response === 0) {
							this.installUpdate();
						}
					})
					.catch((error) => {
						console.error("Auto-update restart dialog failed:", error);
					});
				return;
			default:
				return;
		}
	}
}
