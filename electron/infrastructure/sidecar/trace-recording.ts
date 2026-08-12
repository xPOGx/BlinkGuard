import { app, dialog, type BrowserWindow } from "electron";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { TraceRecordingResult } from "../../../shared/trace-recording";
import type { BlinkDetectorSidecar } from "../sidecar/blink-detector-sidecar";

function defaultTraceDir(): string {
	const dir = path.join(app.getPath("userData"), "traces");
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
	return dir;
}

function defaultTraceFilename(): string {
	const stamp = new Date()
		.toISOString()
		.replace(/[:.]/g, "-")
		.replace("T", "_")
		.replace("Z", "");
	return `session_${stamp}.ndjson`;
}

export async function startTraceRecordingDialog(options: {
	sidecar: BlinkDetectorSidecar;
	parentWindow: BrowserWindow | null;
}): Promise<TraceRecordingResult> {
	if (!options.sidecar.isRunning) {
		return {
			status: "error",
			message: "Blink detector is not running — start tracking first",
		};
	}

	const dialogOptions = {
		title: "Save EAR trace",
		defaultPath: path.join(defaultTraceDir(), defaultTraceFilename()),
		filters: [
			{ name: "EAR trace", extensions: ["ndjson"] },
			{ name: "All files", extensions: ["*"] },
		],
	};

	const { canceled, filePath } =
		options.parentWindow && !options.parentWindow.isDestroyed()
			? await dialog.showSaveDialog(options.parentWindow, dialogOptions)
			: await dialog.showSaveDialog(dialogOptions);

	if (canceled || !filePath) {
		return { status: "cancelled" };
	}

	const resolved = filePath.toLowerCase().endsWith(".ndjson")
		? filePath
		: `${filePath}.ndjson`;

	const ok = options.sidecar.startTraceRecording(resolved);
	if (!ok) {
		return {
			status: "error",
			message: "Failed to send record_trace to sidecar",
		};
	}
	const hint = options.sidecar.isCameraReady
		? undefined
		: "Recording armed — turn the camera on to capture frames, then Stop recording when done";
	return { status: "started", path: resolved, message: hint };
}

export function stopTraceRecordingSession(
	sidecar: BlinkDetectorSidecar,
): TraceRecordingResult {
	if (!sidecar.isRunning) {
		return {
			status: "error",
			message: "Blink detector is not running",
		};
	}
	const ok = sidecar.stopTraceRecording();
	if (!ok) {
		return {
			status: "error",
			message: "Failed to send stop_trace to sidecar",
		};
	}
	return { status: "stopped" };
}
