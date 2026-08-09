import { app, dialog, shell, type BrowserWindow } from "electron";
import { writeFileSync } from "node:fs";
import path from "node:path";
import type { ExportProfileImageResult } from "../../../shared/profile-export";

export interface ExportProfileImageOptions {
	pngBytes: Uint8Array;
	parentWindow?: BrowserWindow | null;
}

function formatStamp(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export async function exportProfileImageFile(
	options: ExportProfileImageOptions,
): Promise<ExportProfileImageResult> {
	const stamp = formatStamp(new Date());
	const defaultName = `BlinkGuard-profile-${stamp}.png`;
	const desktop = app.getPath("desktop");

	const dialogOptions = {
		title: "Save BlinkGuard profile card",
		defaultPath: path.join(desktop, defaultName),
		filters: [{ name: "PNG image", extensions: ["png"] }],
	};
	const save = options.parentWindow
		? await dialog.showSaveDialog(options.parentWindow, dialogOptions)
		: await dialog.showSaveDialog(dialogOptions);

	if (save.canceled || !save.filePath) {
		return { status: "cancelled" };
	}

	const pngPath = save.filePath.toLowerCase().endsWith(".png")
		? save.filePath
		: `${save.filePath}.png`;

	try {
		writeFileSync(pngPath, Buffer.from(options.pngBytes));
		shell.showItemInFolder(pngPath);
		return { status: "saved", path: pngPath };
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Failed to write profile image";
		return { status: "error", message };
	}
}
