/** Fallback slightly above renderer boot-splash SAFETY_DISMISS_MS (8s). */
export const TRACKING_RESTORE_FALLBACK_MS = 10_000;

export type DeferredTrackingRestoreOptions = {
	/** True when persisted prefs say tracking was on at cold start. */
	pending: boolean;
	isTracking: () => boolean;
	start: () => void;
	fallbackMs?: number;
	schedule?: typeof setTimeout;
	clearSchedule?: typeof clearTimeout;
};

/**
 * One-shot cold-start restore for reminder tracking.
 * Waits for settings shell ready (or a safety timeout) before calling start().
 */
export class DeferredTrackingRestore {
	private pending: boolean;
	private settled = false;
	private timer: ReturnType<typeof setTimeout> | null = null;
	private readonly isTracking: () => boolean;
	private readonly start: () => void;
	private readonly fallbackMs: number;
	private readonly schedule: typeof setTimeout;
	private readonly clearSchedule: typeof clearTimeout;

	constructor(options: DeferredTrackingRestoreOptions) {
		this.pending = options.pending;
		this.isTracking = options.isTracking;
		this.start = options.start;
		this.fallbackMs = options.fallbackMs ?? TRACKING_RESTORE_FALLBACK_MS;
		this.schedule = options.schedule ?? setTimeout;
		this.clearSchedule = options.clearSchedule ?? clearTimeout;
	}

	get isPending(): boolean {
		return this.pending && !this.settled;
	}

	/** Arm safety timeout; no-op when restore was never needed. */
	armFallback(): void {
		if (!this.isPending || this.timer !== null) return;
		this.timer = this.schedule(() => {
			this.timer = null;
			this.tryRestore();
		}, this.fallbackMs);
	}

	onShellReady(): void {
		this.tryRestore();
	}

	private tryRestore(): void {
		if (this.settled || !this.pending) return;
		this.settled = true;
		this.pending = false;
		if (this.timer !== null) {
			this.clearSchedule(this.timer);
			this.timer = null;
		}
		if (this.isTracking()) this.start();
	}
}
