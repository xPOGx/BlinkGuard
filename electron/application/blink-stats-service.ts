import {
	computeBlinksPerMinute,
	pruneBlinkTimestamps,
} from "../../shared/blink-rate";
import {
	BLINK_STATS_STORE_KEY,
	DEFAULT_BLINK_STATS,
	type BlinkStatsSnapshot,
	type BlinkStatsState,
	addTrackingMs,
	normalizeBlinkStatsState,
	recordBlink,
	recordSessionStart,
	spendBlinks,
	toBlinkStatsSnapshot,
} from "../../shared/blink-stats";
import type { PreferenceStore } from "./ports/preference-store";

const TRACKING_FLUSH_MS = 15_000;
const PUSH_THROTTLE_MS = 1_000;
const RATE_TICK_MS = 1_000;

export class BlinkStatsService {
	private state: BlinkStatsState;
	private trackingStartedAt: number | null = null;
	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private rateTickTimer: ReturnType<typeof setInterval> | null = null;
	private pushTimer: ReturnType<typeof setTimeout> | null = null;
	private onPush: ((snapshot: BlinkStatsSnapshot) => void) | null = null;
	/** Ephemeral credited-blink timestamps for live BPM (not persisted). */
	private blinkTimestamps: number[] = [];

	constructor(private readonly store: PreferenceStore) {
		this.state = normalizeBlinkStatsState(
			this.store.get(BLINK_STATS_STORE_KEY, DEFAULT_BLINK_STATS),
		);
		this.persist();
	}

	setPushHandler(handler: (snapshot: BlinkStatsSnapshot) => void): void {
		this.onPush = handler;
	}

	getSnapshot(now: Date = new Date()): BlinkStatsSnapshot {
		const nowMs = now.getTime();
		this.blinkTimestamps = pruneBlinkTimestamps(this.blinkTimestamps, nowMs);
		return toBlinkStatsSnapshot(
			this.state,
			now,
			computeBlinksPerMinute(this.blinkTimestamps, nowMs),
		);
	}

	recordBlink(now: Date = new Date()): void {
		const nowMs = now.getTime();
		this.state = recordBlink(this.state, now);
		this.blinkTimestamps = pruneBlinkTimestamps(
			[...this.blinkTimestamps, nowMs],
			nowMs,
		);
		this.persist();
		this.schedulePush();
	}

	/**
	 * Stub for future rewards — deducts from the spendable blink balance.
	 * Not wired to IPC yet.
	 */
	spend(amount: number): boolean {
		const next = spendBlinks(this.state, amount);
		if (!next) return false;
		this.state = next;
		this.persist();
		this.schedulePush(true);
		return true;
	}

	onTrackingStart(now: Date = new Date()): void {
		if (this.trackingStartedAt !== null) return;
		this.state = recordSessionStart(this.state, now);
		this.trackingStartedAt = now.getTime();
		this.persist();
		this.startFlushTimer();
		this.startRateTick();
		this.schedulePush();
	}

	onTrackingStop(now: Date = new Date()): void {
		this.flushTracking(now);
		this.stopFlushTimer();
		this.stopRateTick();
		this.trackingStartedAt = null;
		this.schedulePush(true);
	}

	reset(): void {
		this.stopFlushTimer();
		this.stopRateTick();
		this.blinkTimestamps = [];
		const wasTracking = this.trackingStartedAt !== null;
		this.trackingStartedAt = null;
		this.state = { ...DEFAULT_BLINK_STATS, days: [] };
		this.persist();
		if (wasTracking) {
			this.onTrackingStart();
		} else {
			this.schedulePush(true);
		}
	}

	/** Flush pending tracking time (e.g. before quit). */
	dispose(): void {
		this.flushTracking();
		this.stopFlushTimer();
		this.stopRateTick();
		if (this.pushTimer) {
			clearTimeout(this.pushTimer);
			this.pushTimer = null;
		}
	}

	private flushTracking(now: Date = new Date()): void {
		if (this.trackingStartedAt === null) return;
		const elapsed = now.getTime() - this.trackingStartedAt;
		this.trackingStartedAt = now.getTime();
		if (elapsed <= 0) return;
		this.state = addTrackingMs(this.state, elapsed, now);
		this.persist();
	}

	private startFlushTimer(): void {
		this.stopFlushTimer();
		this.flushTimer = setInterval(() => {
			this.flushTracking();
			this.schedulePush();
		}, TRACKING_FLUSH_MS);
	}

	private stopFlushTimer(): void {
		if (this.flushTimer) {
			clearInterval(this.flushTimer);
			this.flushTimer = null;
		}
	}

	private startRateTick(): void {
		this.stopRateTick();
		this.rateTickTimer = setInterval(() => {
			this.schedulePush();
		}, RATE_TICK_MS);
	}

	private stopRateTick(): void {
		if (this.rateTickTimer) {
			clearInterval(this.rateTickTimer);
			this.rateTickTimer = null;
		}
	}

	private persist(): void {
		this.store.set(BLINK_STATS_STORE_KEY, this.state);
	}

	private schedulePush(immediate = false): void {
		if (!this.onPush) return;
		if (immediate) {
			if (this.pushTimer) {
				clearTimeout(this.pushTimer);
				this.pushTimer = null;
			}
			this.onPush(this.getSnapshot());
			return;
		}
		if (this.pushTimer) return;
		this.pushTimer = setTimeout(() => {
			this.pushTimer = null;
			this.onPush?.(this.getSnapshot());
		}, PUSH_THROTTLE_MS);
	}
}
