import { app } from "electron";
import {
	appendFileSync,
	existsSync,
	mkdirSync,
	renameSync,
	statSync,
	unlinkSync,
} from "node:fs";
import path from "node:path";

/** Rotate when the active JSONL file exceeds this size (8 MB). */
const MAX_LOG_BYTES = 8 * 1024 * 1024;

export type BlinkDebugLogSource = "sidecar" | "main";

/**
 * Append-only blink-detector debug log under Electron userData:
 * `{userData}/logs/blink-detector.jsonl`
 * (Windows: typically `%APPDATA%/BlinkGuard/logs/blink-detector.jsonl`).
 *
 * Console stays short (credited / rejected); the file gets full JSONL payloads.
 */
export class BlinkDetectorDebugLogger {
	private readonly logPath: string;
	private pathAnnounced = false;

	constructor(logDirectory?: string) {
		const directory =
			logDirectory ?? path.join(app.getPath("userData"), "logs");
		this.logPath = path.join(directory, "blink-detector.jsonl");
	}

	get path(): string {
		return this.logPath;
	}

	/** Ensures the log directory exists and prints the absolute path once. */
	announce(): void {
		this.ensureDirectory();
		if (this.pathAnnounced) return;
		this.pathAnnounced = true;
		console.log(`Blink debug log: ${this.logPath}`);
	}

	/**
	 * Capture sidecar NDJSON messages that carry debug / blinkDebug.
	 * Does not change the blink credit protocol — logging only.
	 */
	captureSidecarMessage(message: Record<string, unknown>): void {
		const hasBlinkDebug = message.blinkDebug != null;
		const hasDebug = message.debug != null;
		if (!hasBlinkDebug && !hasDebug) return;

		this.announce();

		if (hasBlinkDebug) {
			const blinkDebug = message.blinkDebug as Record<string, unknown>;
			console.log(shortBlinkConsoleLine(blinkDebug));
			this.append({
				source: "sidecar",
				type: "blinkDebug",
				blinkDebug,
				...(typeof message.debug === "string"
					? { message: message.debug }
					: {}),
			});
			return;
		}

		const debugText = String(message.debug);
		// Blink outcomes also arrive as a separate blinkDebug message — file only
		// here so the console stays a single short credited/rejected line.
		this.append({
			source: "sidecar",
			type: "debug",
			message: debugText,
		});
	}

	append(entry: {
		source: BlinkDebugLogSource;
		type: string;
		message?: string;
		blinkDebug?: Record<string, unknown>;
		raw?: unknown;
	}): void {
		this.ensureDirectory();
		this.rotateIfNeeded();
		const record: Record<string, unknown> = {
			ts: new Date().toISOString(),
			source: entry.source,
			type: entry.type,
		};
		if (entry.message !== undefined) record.message = entry.message;
		if (entry.blinkDebug !== undefined) record.blinkDebug = entry.blinkDebug;
		if (entry.raw !== undefined) record.raw = entry.raw;
		try {
			appendFileSync(this.logPath, `${JSON.stringify(record)}\n`, "utf8");
		} catch (error) {
			console.error("Failed to write blink debug log:", error);
		}
	}

	private ensureDirectory(): void {
		const directory = path.dirname(this.logPath);
		if (existsSync(directory)) return;
		try {
			mkdirSync(directory, { recursive: true });
		} catch (error) {
			console.error("Failed to create blink debug log directory:", error);
		}
	}

	private rotateIfNeeded(): void {
		try {
			if (!existsSync(this.logPath)) return;
			if (statSync(this.logPath).size < MAX_LOG_BYTES) return;
			const rotated = `${this.logPath}.1`;
			if (existsSync(rotated)) unlinkSync(rotated);
			renameSync(this.logPath, rotated);
		} catch {
			// Rotation is best-effort; keep appending if rename fails.
		}
	}
}

function shortBlinkConsoleLine(blinkDebug: Record<string, unknown>): string {
	if (blinkDebug.credited === true) return "Blink credited";
	const reason =
		typeof blinkDebug.phase === "string" && blinkDebug.phase.length > 0
			? blinkDebug.phase
			: "unknown";
	return `Blink rejected (${reason})`;
}
