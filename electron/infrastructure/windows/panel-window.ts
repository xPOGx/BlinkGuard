import { BrowserWindow, type Rectangle } from "electron";

export interface PanelWindowOptions {
	width: number;
	height: number;
	x: number;
	y: number;
	focusable: boolean;
	resizable?: boolean;
	minWidth?: number;
	minHeight?: number;
	/**
	 * Ambient-style overlay: full display including taskbar/dock.
	 * On Windows, skips `type: "panel"` and disables `thickFrame` so
	 * `screen-saver` always-on-top can stack above the taskbar.
	 */
	coverSystemChrome?: boolean;
}

/** Highest always-on-top band that Electron documents as above the Win taskbar / Mac Dock. */
export function panelAlwaysOnTopLevel(
	coverSystemChrome = false,
): "floating" | "screen-saver" {
	if (process.platform === "darwin") {
		// floating…status sit below the Dock; screen-saver is above.
		return coverSystemChrome ? "screen-saver" : "floating";
	}
	return "screen-saver";
}

/**
 * Force geometry + z-order after show (Windows often reclamps or re-stacks
 * transparent windows under the taskbar otherwise).
 */
export function pinPanelAboveSystemChrome(
	window: BrowserWindow,
	bounds: Rectangle,
	coverSystemChrome = true,
): void {
	if (window.isDestroyed()) return;
	window.setBounds(bounds);
	window.setAlwaysOnTop(true, panelAlwaysOnTopLevel(coverSystemChrome));
	window.moveTop();
}

export function createPanelWindow(
	options: PanelWindowOptions,
	preload: string,
): BrowserWindow {
	const {
		coverSystemChrome = false,
		resizable,
		minWidth,
		minHeight,
		width,
		height,
		x,
		y,
		focusable,
	} = options;

	const window = new BrowserWindow({
		width,
		height,
		x,
		y,
		focusable,
		minWidth,
		minHeight,
		frame: false,
		transparent: true,
		alwaysOnTop: true,
		resizable: resizable ?? false,
		skipTaskbar: true,
		show: false,
		hasShadow: false,
		acceptFirstMouse: false,
		fullscreenable: false,
		// `type: "panel"` + default thickFrame keep Win overlays under the taskbar.
		...(coverSystemChrome && process.platform === "win32"
			? { thickFrame: false }
			: { type: "panel" as const }),
		webPreferences: {
			nodeIntegration: false,
			contextIsolation: true,
			preload,
		},
	});
	window.setAlwaysOnTop(true, panelAlwaysOnTopLevel(coverSystemChrome));
	window.setVisibleOnAllWorkspaces(true, {
		visibleOnFullScreen: true,
		skipTransformProcessType: true,
	});
	return window;
}
