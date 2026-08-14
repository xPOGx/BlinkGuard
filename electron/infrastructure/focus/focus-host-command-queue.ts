/**
 * Serial stdin/stdout round-trips against the long-lived Win/mac probe host.
 * Probe (`c`) and running-app list (`l`) must not share a single pending slot.
 */
export class FocusHostCommandQueue {
	private pending: {
		resolve: (value: string) => void;
		reject: (error: Error) => void;
	} | null = null;
	private waiters: Array<{
		line: string;
		timeoutMs: number;
		resolve: (value: string) => void;
		reject: (error: Error) => void;
	}> = [];
	private send: ((line: string) => void) | null = null;

	constructor(private readonly onStale?: () => void) {}

	attach(send: (line: string) => void): void {
		this.send = send;
		this.flush();
	}

	detach(error: Error): void {
		this.send = null;
		this.failAll(error);
	}

	enqueue(line: string, timeoutMs: number): Promise<string> {
		return new Promise((resolve, reject) => {
			this.waiters.push({ line, timeoutMs, resolve, reject });
			this.flush();
		});
	}

	onLine(line: string): void {
		if (!this.pending) return;
		const { resolve } = this.pending;
		this.pending = null;
		resolve(line);
		this.flush();
	}

	failAll(error: Error): void {
		if (this.pending) {
			this.pending.reject(error);
			this.pending = null;
		}
		const leftover = this.waiters.splice(0);
		for (const waiter of leftover) waiter.reject(error);
	}

	private flush(): void {
		if (this.pending || !this.send || this.waiters.length === 0) return;
		const next = this.waiters.shift();
		if (!next) return;
		this.pending = { resolve: next.resolve, reject: next.reject };
		try {
			this.send(next.line);
		} catch (error) {
			this.pending = null;
			next.reject(error instanceof Error ? error : new Error(String(error)));
			this.flush();
			return;
		}
		const { resolve } = next;
		setTimeout(() => {
			if (this.pending?.resolve !== resolve) return;
			this.pending = null;
			next.reject(new Error("fullscreen host timed out"));
			this.onStale?.();
		}, next.timeoutMs);
	}
}
