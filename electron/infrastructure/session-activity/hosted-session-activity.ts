import type { ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
	EMPTY_SESSION_ACTIVITY,
	sameSessionActivitySnapshot,
	type SessionActivityPort,
	type SessionActivitySnapshot,
} from "../../application/ports/session-activity-port";
import { SessionActivityHost } from "./session-activity-host";
import { parseSessionActivityLine } from "./session-activity-protocol";

/** Shared file-backed stdout probe used by the Win/mac session-activity hosts. */
export class HostedSessionActivity implements SessionActivityPort {
	private scriptPath: string | null = null;
	private snapshot: SessionActivitySnapshot = EMPTY_SESSION_ACTIVITY;
	private readonly host: SessionActivityHost;

	constructor(
		private readonly onChange: (snapshot: SessionActivitySnapshot) => void,
		private readonly scriptFileName: string,
		private readonly script: string,
		private readonly spawnFromPath: (
			scriptPath: string,
		) => ChildProcessWithoutNullStreams,
	) {
		this.host = new SessionActivityHost(
			() => this.spawnFromPath(this.ensureScriptPath()),
			(line) => this.handleLine(line),
		);
	}

	start(): void {
		this.host.start();
	}

	dispose(): void {
		this.host.dispose();
	}

	private handleLine(line: string): void {
		const next = parseSessionActivityLine(line, this.snapshot);
		if (!next || sameSessionActivitySnapshot(next, this.snapshot)) return;
		this.snapshot = next;
		this.onChange(next);
	}

	private ensureScriptPath(): string {
		if (this.scriptPath) return this.scriptPath;
		const file = path.join(os.tmpdir(), this.scriptFileName);
		fs.writeFileSync(file, this.script, "utf8");
		this.scriptPath = file;
		return file;
	}
}
