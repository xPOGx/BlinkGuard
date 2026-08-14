import type { ChildProcessWithoutNullStreams } from "node:child_process";

/**
 * Long-lived stdout host: drain lines, kill on dispose.
 */
export class SessionActivityHost {
	private child: ChildProcessWithoutNullStreams | null = null;
	private buffer = "";

	constructor(
		private readonly spawnHost: () => ChildProcessWithoutNullStreams,
		private readonly onLine: (line: string) => void,
	) {}

	start(): void {
		if (this.child && !this.child.killed) return;
		try {
			const child = this.spawnHost();
			child.stdout.setEncoding("utf8");
			child.stdout.on("data", (chunk: string) => {
				this.buffer += chunk;
				this.drain();
			});
			child.stderr?.resume();
			child.on("exit", () => {
				if (this.child === child) this.child = null;
			});
			this.child = child;
		} catch {
			this.child = null;
		}
	}

	dispose(): void {
		this.buffer = "";
		const child = this.child;
		this.child = null;
		if (!child || child.killed) return;
		try {
			child.stdin.write("q\n");
		} catch {
			/* ignore */
		}
		child.kill();
	}

	private drain(): void {
		while (true) {
			const newline = this.buffer.indexOf("\n");
			if (newline === -1) return;
			const line = this.buffer.slice(0, newline).trim();
			this.buffer = this.buffer.slice(newline + 1);
			if (line) this.onLine(line);
		}
	}
}
