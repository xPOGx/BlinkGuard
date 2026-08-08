import { app, dialog } from "electron";
import electronUpdater from "electron-updater";
import { t, type Locale } from "../../../shared/i18n";
import { hasUpdateFeed, isAutoUpdatePlatform } from "./update-feed";

// electron-updater is CJS; named ESM imports fail under Electron's ESM loader.
const { autoUpdater } = electronUpdater;

export type CheckForUpdatesOptions = {
	/** When true, show dialogs for up-to-date / errors (tray / About). */
	interactive?: boolean;
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
	/** Prefer interactive dialogs once the user asked via tray / About. */
	private interactivePending = false;

	constructor(private readonly getLocale: () => Locale) {}

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
				if (this.interactivePending) {
					this.interactivePending = false;
					this.showError();
				}
				this.checking = false;
			});

			autoUpdater.on("update-not-available", () => {
				this.checking = false;
				if (this.interactivePending) {
					this.interactivePending = false;
					this.showUpToDate();
				}
			});

			autoUpdater.on("update-available", () => {
				this.checking = false;
				// Quiet download; restart prompt comes on update-downloaded.
			});

			autoUpdater.on("update-downloaded", (info) => {
				this.checking = false;
				this.interactivePending = false;
				this.downloadedVersion = info.version;
				this.promptRestart(info.version);
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
					this.showError();
				}
				return;
			}

			if (options.interactive) {
				this.interactivePending = true;
			}

			if (this.downloadedVersion) {
				this.interactivePending = false;
				this.promptRestart(this.downloadedVersion);
				return;
			}

			if (this.checking) return;
			this.checking = true;

			void autoUpdater.checkForUpdates().catch((error) => {
				console.error("Auto-update check failed:", error);
				this.checking = false;
				if (this.interactivePending) {
					this.interactivePending = false;
					this.showError();
				}
			});
		} catch (error) {
			console.error("Auto-update check failed:", error);
			this.checking = false;
			if (options.interactive) {
				this.interactivePending = false;
				this.showError();
			}
		}
	}

	private showUpToDate(): void {
		const locale = this.getLocale();
		void dialog.showMessageBox({
			type: "info",
			title: t(locale, "updates.upToDate.title"),
			message: t(locale, "updates.upToDate.message"),
			buttons: [t(locale, "updates.ok")],
			defaultId: 0,
			noLink: true,
		});
	}

	private showError(): void {
		const locale = this.getLocale();
		void dialog.showMessageBox({
			type: "warning",
			title: t(locale, "updates.error.title"),
			message: t(locale, "updates.error.message"),
			buttons: [t(locale, "updates.ok")],
			defaultId: 0,
			noLink: true,
		});
	}

	private promptRestart(version: string): void {
		const locale = this.getLocale();
		void dialog
			.showMessageBox({
				type: "info",
				title: t(locale, "updates.ready.title"),
				message: t(locale, "updates.ready.message", { version }),
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
					try {
						autoUpdater.quitAndInstall(false, true);
					} catch (error) {
						console.error("Auto-update install failed:", error);
					}
				}
			})
			.catch((error) => {
				console.error("Auto-update restart dialog failed:", error);
			});
	}
}
