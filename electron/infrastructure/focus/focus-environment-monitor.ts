import type { FocusEnvironmentPort } from "../../application/ports/focus-environment-port";
import {
	EMPTY_FOREGROUND_SNAPSHOT,
	sameForegroundSnapshot,
	type FocusForegroundSnapshot,
} from "../../application/ports/focus-environment-port";

const DEFAULT_POLL_MS = 1500;

/**
 * Polls the environment port on an interval so callers can read a fresh-ish
 * foreground snapshot without blocking the main process on every tick.
 */
export class FocusEnvironmentMonitor {
	private timer: ReturnType<typeof setInterval> | null = null;
	private snapshot: FocusForegroundSnapshot = EMPTY_FOREGROUND_SNAPSHOT;

	constructor(
		private readonly environment: FocusEnvironmentPort,
		private readonly onChange?: (snapshot: FocusForegroundSnapshot) => void,
	) {}

	get isFullscreen(): boolean {
		return this.snapshot.isFullscreen;
	}

	get foreground(): FocusForegroundSnapshot {
		return this.snapshot;
	}

	start(pollMs = DEFAULT_POLL_MS): void {
		if (this.timer) return;
		this.tick();
		this.timer = setInterval(() => this.tick(), pollMs);
	}

	stop(): void {
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}

	private tick(): void {
		const next = this.environment.probeForeground();
		if (sameForegroundSnapshot(next, this.snapshot)) return;
		this.snapshot = next;
		this.onChange?.(next);
	}
}
