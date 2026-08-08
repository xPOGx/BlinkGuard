import {
	BLINK_RATE_WINDOW_MS,
	computeBlinksPerMinute,
	pruneBlinkTimestamps,
} from "../../shared/blink-rate";
import {
	BLINK_STATS_STORE_KEY,
	DEFAULT_BLINK_STATS,
	type BlinkStatsSnapshot,
	type BlinkStatsState,
	addTrackingMs,
	localDateKey,
	normalizeBlinkStatsState,
	recordBlink,
	recordSessionStart,
	spendBlinks,
	todaySummary,
	toBlinkStatsSnapshot,
	totalsSummary,
} from "../../shared/blink-stats";
import type { Locale } from "../../shared/i18n";
import type { PreferenceStore } from "./ports/preference-store";

const TRACKING_FLUSH_MS = 15_000;
const PUSH_THROTTLE_MS = 1_000;
const RATE_TICK_MS = 1_000;

export class BlinkStatsService {
	private state: BlinkStatsState;
	private trackingStartedAt: number | null = null;
	/** Wall-clock start of the current tracking session (not reset by flush). */
	private rateSessionStartedAt: number | null = null;
	private flushTimer: ReturnType<typeof setInterval> | null = null;
	private rateTickTimer: ReturnType<typeof setInterval> | null = null;
	private pushTimer: ReturnType<typeof setTimeout> | null = null;
	private onPush: ((snapshot: BlinkStatsSnapshot) => void) | null = null;
	/** Ephemeral credited-blink timestamps for live BPM (not persisted). */
	private blinkTimestamps: number[] = [];
	/** Last BPM included in a pushed snapshot — skip redundant rate ticks. */
	private lastPushedBpm: number | null = null;
	/** Last warmup second pushed while collecting the first minute. */
	private lastPushedWarmupSec: number | null = null;
	/** True while the Statistics settings panel is mounted. */
	private livePushEnabled = false;
	/** Cached charts; rebuilt only when blink/session totals change. */
	private chartsDirty = true;
	private cachedCharts: Pick<
		BlinkStatsSnapshot,
		"dayChart" | "weekChart" | "monthChart" | "yearChart"
	> | null = null;
	private cachedLocale: Locale | null = null;

	constructor(
		private readonly store: PreferenceStore,
		private readonly getLocale: () => Locale = () => "en",
	) {
		this.state = normalizeBlinkStatsState(
			this.store.get(BLINK_STATS_STORE_KEY, DEFAULT_BLINK_STATS),
		);
		this.persist();
	}

	invalidateCharts(): void {
		this.chartsDirty = true;
		this.cachedCharts = null;
		this.cachedLocale = null;
	}

	setPushHandler(handler: (snapshot: BlinkStatsSnapshot) => void): void {
		this.onPush = handler;
	}

	/** Enable/disable IPC pushes + rate tick (Statistics panel visibility). */
	setLivePushEnabled(enabled: boolean): void {
		if (this.livePushEnabled === enabled) {
			if (enabled) this.pushSnapshot();
			return;
		}
		this.livePushEnabled = enabled;
		if (enabled) {
			if (this.rateSessionStartedAt !== null) this.startRateTick();
			this.pushSnapshot();
			return;
		}
		this.stopRateTick();
		if (this.pushTimer) {
			clearTimeout(this.pushTimer);
			this.pushTimer = null;
		}
	}

	isLivePushEnabled(): boolean {
		return this.livePushEnabled;
	}

	getSnapshot(now: Date = new Date()): BlinkStatsSnapshot {
		const nowMs = now.getTime();
		this.blinkTimestamps = pruneBlinkTimestamps(this.blinkTimestamps, nowMs);
		const { ready, warmupMs } = this.rateWarmup(nowMs);
		const blinksPerMinute = ready
			? computeBlinksPerMinute(this.blinkTimestamps, nowMs)
			: 0;
		const today = localDateKey(now);
		const locale = this.getLocale();

		if (
			this.chartsDirty ||
			!this.cachedCharts ||
			this.cachedLocale !== locale
		) {
			const full = toBlinkStatsSnapshot(
				this.state,
				now,
				blinksPerMinute,
				ready,
				warmupMs,
				locale,
			);
			this.cachedCharts = {
				dayChart: full.dayChart,
				weekChart: full.weekChart,
				monthChart: full.monthChart,
				yearChart: full.yearChart,
			};
			this.chartsDirty = false;
			this.cachedLocale = locale;
			return full;
		}

		return {
			today: todaySummary(this.state, today),
			totals: totalsSummary(this.state),
			...this.cachedCharts,
			blinksPerMinute,
			blinkRateReady: ready,
			blinkRateWarmupMs: warmupMs,
		};
	}

	recordBlink(now: Date = new Date()): void {
		const nowMs = now.getTime();
		this.state = recordBlink(this.state, now);
		this.blinkTimestamps = pruneBlinkTimestamps(
			[...this.blinkTimestamps, nowMs],
			nowMs,
		);
		this.markChartsDirty();
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
		this.markChartsDirty();
		this.persist();
		this.schedulePush(true);
		return true;
	}

	onTrackingStart(now: Date = new Date()): void {
		if (this.trackingStartedAt !== null) return;
		this.state = recordSessionStart(this.state, now);
		this.trackingStartedAt = now.getTime();
		this.rateSessionStartedAt = now.getTime();
		this.lastPushedWarmupSec = null;
		this.markChartsDirty();
		this.persist();
		this.startFlushTimer();
		if (this.livePushEnabled) this.startRateTick();
		this.schedulePush();
	}

	onTrackingStop(now: Date = new Date()): void {
		this.flushTracking(now);
		this.stopFlushTimer();
		this.stopRateTick();
		this.trackingStartedAt = null;
		this.rateSessionStartedAt = null;
		this.lastPushedWarmupSec = null;
		this.blinkTimestamps = [];
		this.lastPushedBpm = null;
		this.schedulePush(true);
	}

	reset(): void {
		this.stopFlushTimer();
		this.stopRateTick();
		this.blinkTimestamps = [];
		this.lastPushedBpm = null;
		this.lastPushedWarmupSec = null;
		this.markChartsDirty();
		const wasTracking = this.trackingStartedAt !== null;
		this.trackingStartedAt = null;
		this.rateSessionStartedAt = null;
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
		this.livePushEnabled = false;
		if (this.pushTimer) {
			clearTimeout(this.pushTimer);
			this.pushTimer = null;
		}
	}

	private rateWarmup(nowMs: number): { ready: boolean; warmupMs: number } {
		if (this.rateSessionStartedAt === null) {
			return { ready: false, warmupMs: 0 };
		}
		const elapsed = Math.max(0, nowMs - this.rateSessionStartedAt);
		const warmupMs = Math.min(elapsed, BLINK_RATE_WINDOW_MS);
		return {
			ready: elapsed >= BLINK_RATE_WINDOW_MS,
			warmupMs,
		};
	}

	private markChartsDirty(): void {
		this.chartsDirty = true;
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
			this.tickLiveRate();
		}, RATE_TICK_MS);
	}

	private stopRateTick(): void {
		if (this.rateTickTimer) {
			clearInterval(this.rateTickTimer);
			this.rateTickTimer = null;
		}
	}

	/**
	 * While warming up: push once per elapsed second for progress UI.
	 * After ready: only push when BPM changes (decay / new blinks).
	 */
	private tickLiveRate(nowMs: number = Date.now()): void {
		if (!this.livePushEnabled || this.rateSessionStartedAt === null) return;

		const { ready, warmupMs } = this.rateWarmup(nowMs);
		if (!ready) {
			const sec = Math.floor(warmupMs / 1000);
			if (sec === this.lastPushedWarmupSec) return;
			this.lastPushedWarmupSec = sec;
			this.schedulePush();
			return;
		}

		if (this.blinkTimestamps.length === 0) {
			if (this.lastPushedBpm === 0) return;
			this.schedulePush();
			return;
		}
		this.blinkTimestamps = pruneBlinkTimestamps(this.blinkTimestamps, nowMs);
		const bpm = computeBlinksPerMinute(this.blinkTimestamps, nowMs);
		if (bpm === this.lastPushedBpm) return;
		this.schedulePush();
	}

	private persist(): void {
		this.store.set(BLINK_STATS_STORE_KEY, this.state);
	}

	private pushSnapshot(now: Date = new Date()): void {
		if (!this.onPush || !this.livePushEnabled) return;
		const snapshot = this.getSnapshot(now);
		this.lastPushedBpm = snapshot.blinksPerMinute;
		if (!snapshot.blinkRateReady) {
			this.lastPushedWarmupSec = Math.floor(snapshot.blinkRateWarmupMs / 1000);
		}
		this.onPush(snapshot);
	}

	private schedulePush(immediate = false): void {
		if (!this.onPush || !this.livePushEnabled) return;
		if (immediate) {
			if (this.pushTimer) {
				clearTimeout(this.pushTimer);
				this.pushTimer = null;
			}
			this.pushSnapshot();
			return;
		}
		if (this.pushTimer) return;
		this.pushTimer = setTimeout(() => {
			this.pushTimer = null;
			this.pushSnapshot();
		}, PUSH_THROTTLE_MS);
	}
}
