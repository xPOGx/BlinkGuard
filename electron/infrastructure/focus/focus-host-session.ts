import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { screen } from "electron";
import type { PauseAppRule } from "../../../shared/preferences";
import {
	EMPTY_FOREGROUND_SNAPSHOT,
	type FocusForegroundSnapshot,
} from "../../application/ports/focus-environment-port";
import { FocusHostCommandQueue } from "./focus-host-command-queue";
import {
	interpretForegroundSnapshot,
	parseRunningAppListLine,
} from "./fullscreen-geometry";

export const FOCUS_PROBE_TIMEOUT_MS = 1500;
export const FOCUS_LIST_TIMEOUT_MS = 3000;

/**
 * Long-lived Win/mac probe host: serial `c` / `l` commands, stdout line drain,
 * and restart on timeout so a late probe line cannot satisfy a list request.
 */
export class FocusHostSession {
	private host: ChildProcessWithoutNullStreams | null = null;
	private buffer = "";
	private probeQueued = false;
	private lastSnapshot: FocusForegroundSnapshot = EMPTY_FOREGROUND_SNAPSHOT;
	private readonly queue = new FocusHostCommandQueue(() => this.reset());

	constructor(
		private readonly spawnHost: () => ChildProcessWithoutNullStreams,
	) {}

	get snapshot(): FocusForegroundSnapshot {
		return this.lastSnapshot;
	}

	refreshProbe(excludeToken: string): void {
		void this.refresh(excludeToken);
	}

	async listRunningApps(excludeToken: string): Promise<PauseAppRule[]> {
		try {
			const line = await this.sendCommand(
				`l ${excludeToken}\n`,
				FOCUS_LIST_TIMEOUT_MS,
			);
			return parseRunningAppListLine(line);
		} catch {
			return [];
		}
	}

	dispose(): void {
		this.reset();
	}

	private async refresh(excludeToken: string): Promise<void> {
		if (this.probeQueued) return;
		this.probeQueued = true;
		try {
			const line = await this.sendCommand(
				`c ${excludeToken}\n`,
				FOCUS_PROBE_TIMEOUT_MS,
			);
			this.lastSnapshot = interpretForegroundSnapshot(line, (bounds) =>
				screen.getDisplayMatching(bounds).bounds,
			);
		} catch {
			/* keep last snapshot */
		} finally {
			this.probeQueued = false;
		}
	}

	private reset(): void {
		this.buffer = "";
		const host = this.host;
		this.host = null;
		this.queue.detach(new Error("fullscreen host reset"));
		if (host && !host.killed) {
			try {
				host.stdin.write("q\n");
			} catch {
				/* ignore */
			}
			host.kill();
		}
	}

	private ensureHost(): ChildProcessWithoutNullStreams | null {
		if (this.host && !this.host.killed) return this.host;
		try {
			const child = this.spawnHost();
			child.stdout.setEncoding("utf8");
			child.stdout.on("data", (chunk: string) => {
				this.buffer += chunk;
				this.drainLines();
			});
			child.on("exit", () => {
				if (this.host !== child) return;
				this.host = null;
				this.queue.detach(new Error("fullscreen host exited"));
			});
			this.host = child;
			this.queue.attach((line) => {
				child.stdin.write(line);
			});
			return child;
		} catch {
			return null;
		}
	}

	private drainLines(): void {
		while (true) {
			const newline = this.buffer.indexOf("\n");
			if (newline === -1) return;
			const line = this.buffer.slice(0, newline).trim();
			this.buffer = this.buffer.slice(newline + 1);
			this.queue.onLine(line);
		}
	}

	private sendCommand(line: string, timeoutMs: number): Promise<string> {
		if (!this.ensureHost()) return Promise.resolve("0");
		return this.queue.enqueue(line, timeoutMs);
	}
}
