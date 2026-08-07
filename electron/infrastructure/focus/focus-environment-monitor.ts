import type { FocusEnvironmentPort } from "../../application/ports/focus-environment-port";

const DEFAULT_POLL_MS = 1500;

/**
 * Polls the environment port on an interval so callers can read a fresh-ish
 * fullscreen signal without blocking the main process on every tick.
 */
export class FocusEnvironmentMonitor {
	private timer: ReturnType<typeof setInterval> | null = null;
	private fullscreen = false;

	constructor(
		private readonly environment: FocusEnvironmentPort,
		private readonly onChange?: (isFullscreen: boolean) => void,
	) {}

	get isFullscreen(): boolean {
		return this.fullscreen;
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
		const next = this.environment.isOtherAppFullscreen();
		if (next === this.fullscreen) return;
		this.fullscreen = next;
		this.onChange?.(next);
	}
}
