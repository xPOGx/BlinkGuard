import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from "electron";
import path from "node:path";
import { t, type Locale } from "../../../shared/i18n";
import type { AppPaths } from "../paths/app-paths";
import type { WindowManager } from "../windows/window-manager";

export class TrayController {
	private tray: Tray | null = null;

	constructor(
		private readonly paths: AppPaths,
		private readonly windows: WindowManager,
		private readonly onQuit: () => void,
		private readonly getLocale: () => Locale = () => "en",
		private readonly onCheckForUpdates: (() => void) | null = null,
	) {}

	create(): void {
		if (this.tray) return;
		const icon = this.loadIcon();
		this.tray = new Tray(icon);
		this.tray.setToolTip("BlinkGuard");
		this.rebuildMenu(this.getLocale());
		this.tray.on("click", () => this.windows.showMain());
		this.tray.on("double-click", () => this.windows.showMain());
	}

	rebuildMenu(locale: Locale = this.getLocale()): void {
		if (!this.tray) return;
		const items: MenuItemConstructorOptions[] = [
			{
				label: t(locale, "tray.show"),
				click: () => this.windows.showMain(),
			},
		];
		if (this.onCheckForUpdates) {
			items.push({
				label: t(locale, "tray.checkForUpdates"),
				click: () => this.onCheckForUpdates?.(),
			});
		}
		items.push(
			{ type: "separator" },
			{
				label: t(locale, "tray.quit"),
				click: () => this.onQuit(),
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
