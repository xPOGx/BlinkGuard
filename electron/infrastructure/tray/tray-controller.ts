import { Menu, Tray, nativeImage } from "electron";
import path from "node:path";
import type { AppPaths } from "../paths/app-paths";
import type { WindowManager } from "../windows/window-manager";

export class TrayController {
	private tray: Tray | null = null;

	constructor(
		private readonly paths: AppPaths,
		private readonly windows: WindowManager,
		private readonly onQuit: () => void,
	) {}

	create(): void {
		if (this.tray) return;
		const icon = this.loadIcon();
		this.tray = new Tray(icon);
		this.tray.setToolTip("BlinkGuard");
		this.tray.setContextMenu(
			Menu.buildFromTemplate([
				{
					label: "Show BlinkGuard",
					click: () => this.windows.showMain(),
				},
				{ type: "separator" },
				{
					label: "Quit",
					click: () => this.onQuit(),
				},
			]),
		);
		this.tray.on("click", () => this.windows.showMain());
		this.tray.on("double-click", () => this.windows.showMain());
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
