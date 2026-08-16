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
import { IPC_CHANNELS } from "../../../shared/ipc-channels";

/** Rotate when the active JSONL file exceeds this size (4 MB). */
const MAX_LOG_BYTES = 4 * 1024 * 1024;

export type InteractionLogSource = "ipc" | "tray" | "shortcut";

/** High-frequency / non-intent channels — do not append. */
const SKIP_IPC_CHANNELS = new Set<string>([
	IPC_CHANNELS.requestVideoStream,
	IPC_CHANNELS.subscribeBlinkStats,
	IPC_CHANNELS.unsubscribeBlinkStats,
	IPC_CHANNELS.audioFinished,
	IPC_CHANNELS.audioError,
	IPC_CHANNELS.audioOutputInvalidated,
	IPC_CHANNELS.requestBlinkStats,
]);

/**
 * Append-only user-action trail under Electron userData:
 * `{userData}/logs/interactions.jsonl`
 */
export class InteractionLogger {
	private readonly logPath: string;

	constructor(logDirectory?: string) {
		const directory =
			logDirectory ?? path.join(app.getPath("userData"), "logs");
		this.logPath = path.join(directory, "interactions.jsonl");
	}

	get path(): string {
		return this.logPath;
	}

	append(entry: {
		source: InteractionLogSource;
		action: string;
		detail?: unknown;
	}): void {
		this.ensureDirectory();
		this.rotateIfNeeded();
		const record: Record<string, unknown> = {
			ts: new Date().toISOString(),
			source: entry.source,
			action: entry.action,
		};
		if (entry.detail !== undefined) {
			record.detail = entry.detail;
		}
		try {
			appendFileSync(this.logPath, `${JSON.stringify(record)}\n`, "utf8");
		} catch (error) {
			console.error("Failed to write interaction log:", error);
		}
	}

	/** Log an IPC channel if it is not in the noise skip-list. */
	logIpc(channel: string, args: unknown[]): void {
		if (SKIP_IPC_CHANNELS.has(channel)) return;
		const detail = sanitizeIpcDetail(channel, args);
		this.append({
			source: "ipc",
			action: channel,
			...(detail !== undefined ? { detail } : {}),
		});
	}

	private ensureDirectory(): void {
		const directory = path.dirname(this.logPath);
		if (existsSync(directory)) return;
		try {
			mkdirSync(directory, { recursive: true });
		} catch (error) {
			console.error("Failed to create interaction log directory:", error);
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

function sanitizeIpcDetail(
	channel: string,
	args: unknown[],
): unknown | undefined {
	if (args.length === 0) return undefined;

	if (channel === IPC_CHANNELS.updatePopupMessage) {
		const message = typeof args[0] === "string" ? args[0] : "";
		return { present: message.length > 0, length: message.length };
	}

	if (channel === IPC_CHANNELS.updateExercisePrompts) {
		const prompts = Array.isArray(args[0]) ? args[0] : [];
		return {
			count: prompts.length,
			lengths: prompts.map((item) =>
				typeof item === "string" ? item.length : 0,
			),
		};
	}

	if (channel === IPC_CHANNELS.popupEditorSaved) {
		const value = args[0] as
			| { size?: unknown; position?: unknown; scope?: unknown }
			| undefined;
		return {
			size: value?.size ?? null,
			position: value?.position ?? null,
			scope:
				value?.scope === "all"
					? "all"
					: value?.scope === "next"
						? "next"
						: "current",
		};
	}

	if (args.length === 1) return sanitizeValue(args[0]);
	return args.map((arg) => sanitizeValue(arg));
}

function sanitizeValue(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (
		typeof value === "boolean" ||
		typeof value === "number" ||
		typeof value === "string"
	) {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => sanitizeValue(item));
	}
	if (typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(
			value as Record<string, unknown>,
		)) {
			if (
				key === "popupMessage" ||
				key === "exercisePrompts" ||
				key === "lookAwayTitle" ||
				key === "lookAwayHint" ||
				key === "message" ||
				key === "prompt" ||
				key === "prompts" ||
				key === "title" ||
				key === "hint"
			) {
				if (typeof nested === "string") {
					out[key] = { present: nested.length > 0, length: nested.length };
				} else if (Array.isArray(nested)) {
					out[key] = {
						count: nested.length,
						lengths: nested.map((item) =>
							typeof item === "string" ? item.length : 0,
						),
					};
				} else {
					out[key] = "redacted";
				}
				continue;
			}
			out[key] = sanitizeValue(nested);
		}
		return out;
	}
	return String(value);
}
