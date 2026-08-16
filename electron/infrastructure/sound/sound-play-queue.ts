/** Max jobs waiting behind the one currently playing. */
export const MAX_PENDING_SOUND_JOBS = 8;

/**
 * Serializes notification-sound jobs. Pure TypeScript — no Electron.
 * Idle enqueue starts playing immediately; further jobs wait FIFO.
 */
export class SoundPlayQueue<T> {
	private playing: T | null = null;
	private pending: T[] = [];

	get isPlaying(): boolean {
		return this.playing !== null;
	}

	get pendingCount(): number {
		return this.pending.length;
	}

	get current(): T | null {
		return this.playing;
	}

	/**
	 * If idle, `job` becomes current (started). If busy, it is queued.
	 * When pending would exceed {@link MAX_PENDING_SOUND_JOBS}, oldest pending is dropped.
	 */
	enqueue(job: T): { started: boolean; dropped: T[] } {
		if (this.playing === null) {
			this.playing = job;
			return { started: true, dropped: [] };
		}

		this.pending.push(job);
		const dropped: T[] = [];
		while (this.pending.length > MAX_PENDING_SOUND_JOBS) {
			const oldest = this.pending.shift();
			if (oldest !== undefined) dropped.push(oldest);
		}
		return { started: false, dropped };
	}

	/**
	 * Clears the current job. If pending remains, the next job becomes current.
	 * Safe to call when already idle (starts the first pending, if any).
	 */
	finish(): T | null {
		this.playing = null;
		const next = this.pending.shift() ?? null;
		if (next !== null) this.playing = next;
		return next;
	}

	/** Drop the in-flight job only; pending is unchanged. */
	interruptPlaying(): void {
		this.playing = null;
	}

	clear(): void {
		this.playing = null;
		this.pending = [];
	}
}
