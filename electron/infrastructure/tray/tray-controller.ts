import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from "electron";
import path from "node:path";
import { pluralKey, t, type Locale } from "../../../shared/i18n";
import type { InteractionLogger } from "../logging/interaction-logger";
import type { AppPaths } from "../paths/app-paths";
import type { WindowManager } from "../windows/window-manager";

export class TrayController {
	private tray: Tray | null = null;

	constructor(
		private readonly paths: AppPaths,
		private readonly windows: WindowManager,
		private readonly onQuit: () => void,
		private readonly getLocale: () => Locale = () => "en",
		private readonly getSnoozeMinutes: () => number = () => 5,
		private readonly onCheckForUpdates: (() => void) | null = null,
		private readonly interactions: InteractionLogger | null = null,
		private readonly onSnoozeBlink: (() => void) | null = null,
	) {}

	create(): void {
		if (this.tray) return;
		const icon = this.loadIcon();
		this.tray = new Tray(icon);
		this.tray.setToolTip("BlinkGuard");
		this.rebuildMenu(this.getLocale());
		this.tray.on("click", () => {
			this.interactions?.append({ source: "tray", action: "click-show" });
			this.windows.showMain();
		});
		this.tray.on("double-click", () => {
			this.interactions?.append({
				source: "tray",
				action: "double-click-show",
			});
			this.windows.showMain();
		});
	}

	rebuildMenu(locale: Locale = this.getLocale()): void {
		if (!this.tray) return;
		const items: MenuItemConstructorOptions[] = [
			{
				label: t(locale, "tray.show"),
				click: () => {
					this.interactions?.append({ source: "tray", action: "menu-show" });
					this.windows.showMain();
				},
			},
		];
		if (this.onSnoozeBlink) {
			const n = this.getSnoozeMinutes();
			items.push({
				label: t(locale, pluralKey("tray.snoozeBlink", locale, n), { n }),
				click: () => {
					this.interactions?.append({
						source: "tray",
						action: "menu-snooze-blink",
					});
					this.onSnoozeBlink?.();
				},
			});
		}
		if (this.onCheckForUpdates) {
			items.push({
				label: t(locale, "tray.checkForUpdates"),
				click: () => {
					this.interactions?.append({
						source: "tray",
						action: "menu-check-for-updates",
					});
					this.onCheckForUpdates?.();
				},
			});
		}
		items.push(
			{ type: "separator" },
			{
				label: t(locale, "tray.quit"),
				click: () => {
					this.interactions?.append({ source: "tray", action: "menu-quit" });
					this.onQuit();
				},
			},
		);
		this.tray.setContextMenu(Menu.buildFromTemplate(items));
	}

	destroy(): void {
		if (!this.tray) return;
		this.tray.destroy();
		this.tray = null;
	}

	private loadIcon() {
		const pngPath = path.join(this.paths.root, "assets", "icons", "icon.png");
		let image = nativeImage.createFromPath(pngPath);
		if (image.isEmpty() && process.platform === "win32") {
			const icoPath = path.join(
				this.paths.root,
				"assets",
				"icons",
				"icon.ico",
			);
			image = nativeImage.createFromPath(icoPath);
		}
		return image;
	}
}
