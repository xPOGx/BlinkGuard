import { app, dialog } from "electron";
import electronUpdater from "electron-updater";
import type { AutoUpdateStatus } from "../../../shared/auto-update";
import { t, type Locale } from "../../../shared/i18n";
import { hasUpdateFeed, isAutoUpdatePlatform } from "./update-feed";

// electron-updater is CJS; named ESM imports fail under Electron's ESM loader.
const { autoUpdater } = electronUpdater;

export type CheckForUpdatesOptions = {
	/** When true, surface checking / up-to-date / errors (tray / About). */
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
 */
export class AutoUpdateService {
	private enabled = false;
	private checking = false;
	private downloadedVersion: string | null = null;
	private availableVersion: string | null = null;
	/** Prefer interactive UI once the user asked via tray / About. */
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
				if (this.interactivePending) {
					this.interactivePending = false;
					this.present({ state: "error" });
				}
			});

			autoUpdater.on("update-not-available", () => {
				this.checking = false;
				if (this.interactivePending) {
					this.interactivePending = false;
					this.present({ state: "upToDate" });
				}
			});

			autoUpdater.on("update-available", (info) => {
				this.checking = false;
				const version =
					typeof info?.version === "string" && info.version.length > 0
						? info.version
						: "…";
				this.availableVersion = version;
				if (this.interactivePending) {
					this.present({ state: "available", version });
				}
			});

			autoUpdater.on("download-progress", (progress) => {
				if (!this.interactivePending) return;
				const version = this.availableVersion ?? "…";
				const raw =
					typeof progress?.percent === "number" ? progress.percent : 0;
				const percent = Math.max(0, Math.min(100, Math.round(raw)));
				this.present({ state: "downloading", version, percent });
			});

			autoUpdater.on("update-downloaded", (info) => {
				this.checking = false;
				this.interactivePending = false;
				const version =
					typeof info?.version === "string" && info.version.length > 0
						? info.version
						: (this.availableVersion ?? "…");
				this.downloadedVersion = version;
				this.availableVersion = version;
				this.present({ state: "ready", version });
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
					this.present({ state: "unavailable" });
				}
				return;
			}

			if (options.interactive) {
				this.interactivePending = true;
				this.present({ state: "checking" });
			}

			if (this.downloadedVersion) {
				this.interactivePending = false;
				this.present({ state: "ready", version: this.downloadedVersion });
				return;
			}

			if (this.checking) return;
			this.checking = true;

			void autoUpdater.checkForUpdates().catch((error) => {
				console.error("Auto-update check failed:", error);
				this.checking = false;
				if (this.interactivePending) {
					this.interactivePending = false;
					this.present({ state: "error" });
				}
			});
		} catch (error) {
			console.error("Auto-update check failed:", error);
			this.checking = false;
			if (options.interactive) {
				this.interactivePending = false;
				this.present({ state: "error" });
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
			this.present({ state: "error" });
		}
	}

	private present(status: AutoUpdateStatus): void {
		if (this.ui.canHostInAppUi()) {
			this.ui.ensureVisible();
			this.ui.emit(status);
			return;
		}
		this.showNativeFallback(status);
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
				// checking / available / downloading need the in-app UI; skip if no host.
				return;
		}
	}
}
