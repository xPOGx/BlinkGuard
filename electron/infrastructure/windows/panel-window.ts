import { BrowserWindow } from "electron";

export interface PanelWindowOptions {
	width: number;
	height: number;
	x: number;
	y: number;
	focusable: boolean;
	resizable?: boolean;
	minWidth?: number;
	minHeight?: number;
}

export function createPanelWindow(
	options: PanelWindowOptions,
	preload: string,
): BrowserWindow {
	const window = new BrowserWindow({
		...options,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		resizable: options.resizable ?? false,
		skipTaskbar: true,
		show: false,
		hasShadow: false,
		acceptFirstMouse: false,
		type: "panel",
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload,
		},
	});
	window.setAlwaysOnTop(
		true,
		process.platform === "darwin" ? "floating" : "screen-saver",
	);
	window.setVisibleOnAllWorkspaces(true, {
		visibleOnFullScreen: true,
		skipTransformProcessType: true,
	});
	return window;
}
