import { Menu, Tray, nativeImage } from "electron";
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
		this.tray.setContextMenu(
			Menu.buildFromTemplate([
				{
					label: t(locale, "tray.show"),
					click: () => this.windows.showMain(),
				},
				{ type: "separator" },
				{
					label: t(locale, "tray.quit"),
					click: () => this.onQuit(),
				},
			]),
		);
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
