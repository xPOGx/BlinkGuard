import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlinkStatsService } from "../../../electron/application/blink-stats-service";
import type { PreferenceStore } from "../../../electron/application/ports/preference-store";
import {
	BLINK_STATS_STORE_KEY,
	localDateKey,
} from "../../../shared/blink-stats";

function createStore(): PreferenceStore & { data: Map<string, unknown> } {
	const data = new Map<string, unknown>();
	return {
		data,
		get<T>(key: string, defaultValue?: T): T {
			if (data.has(key)) return data.get(key) as T;
			return defaultValue as T;
		},
		set<T>(key: string, value: T): void {
			data.set(key, value);
		},
		has(key: string): boolean {
			return data.has(key);
		},
		clear(): void {
			data.clear();
		},
	};
}

describe("BlinkStatsService", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date(2026, 7, 7, 15, 0, 0));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("persists credited blinks and pushes snapshots when live UI is open", () => {
		const store = createStore();
		const service = new BlinkStatsService(store);
		const push = vi.fn();
		service.setPushHandler(push);
		service.setLivePushEnabled(true);
		push.mockClear();

		service.recordBlink();
		vi.advanceTimersByTime(1000);

		expect(service.getSnapshot().today.blinks).toBe(1);
		expect(service.getSnapshot().totals).toEqual({
			total: 1,
			spent: 0,
			available: 1,
		});
		expect(push).toHaveBeenCalled();
		const persisted = store.get(BLINK_STATS_STORE_KEY) as {
			days: Array<{ date: string; blinks: number }>;
			totalBlinks: number;
		};
		expect(persisted.days[0]?.date).toBe(localDateKey());
		expect(persisted.days[0]?.blinks).toBe(1);
		expect(persisted.totalBlinks).toBe(1);
		service.dispose();
	});

	it("does not push while Statistics is closed", () => {
		const store = createStore();
		const service = new BlinkStatsService(store);
		const push = vi.fn();
		service.setPushHandler(push);

		service.onTrackingStart();
		service.recordBlink();
		vi.advanceTimersByTime(20_000);
		expect(push).not.toHaveBeenCalled();
		expect(service.getSnapshot().today.blinks).toBe(1);

		service.setLivePushEnabled(true);
		expect(push).toHaveBeenCalledTimes(1);

		push.mockClear();
		service.setLivePushEnabled(false);
		service.recordBlink();
		vi.advanceTimersByTime(5_000);
		expect(push).not.toHaveBeenCalled();
		service.dispose();
	});

	it("spend stub deducts available balance", () => {
		const store = createStore();
		const service = new BlinkStatsService(store);
		service.recordBlink();
		service.recordBlink();
		expect(service.spend(1)).toBe(true);
		expect(service.getSnapshot().totals).toEqual({
			total: 2,
			spent: 1,
			available: 1,
		});
		expect(service.spend(5)).toBe(false);
		service.dispose();
	});

	it("tracks sessions and accumulates tracking time on flush", () => {
		const store = createStore();
		const service = new BlinkStatsService(store);

		service.onTrackingStart();
		expect(service.getSnapshot().today.sessions).toBe(1);

		vi.advanceTimersByTime(15_000);
		expect(service.getSnapshot().today.trackingMs).toBeGreaterThanOrEqual(
			15_000,
		);

		service.onTrackingStop();
		const trackingMs = service.getSnapshot().today.trackingMs;
		expect(trackingMs).toBeGreaterThanOrEqual(15_000);

		vi.advanceTimersByTime(30_000);
		expect(service.getSnapshot().today.trackingMs).toBe(trackingMs);
		service.dispose();
	});

	it("reset clears totals and history and restarts an active session", () => {
		const store = createStore();
		const service = new BlinkStatsService(store);
		service.onTrackingStart();
		service.recordBlink();
		service.spend(1);
		service.reset();

		expect(service.getSnapshot().today.blinks).toBe(0);
		expect(service.getSnapshot().today.sessions).toBe(1);
		expect(service.getSnapshot().totals).toEqual({
			total: 0,
			spent: 0,
			available: 0,
		});
		expect(service.getSnapshot().blinksPerMinute).toBe(0);
		service.dispose();
	});

	it("exposes live blinksPerMinute from a rolling window", () => {
		const store = createStore();
		const service = new BlinkStatsService(store);
		const push = vi.fn();
		service.setPushHandler(push);
		service.setLivePushEnabled(true);
		push.mockClear();

		expect(service.getSnapshot().blinksPerMinute).toBe(0);

		service.recordBlink();
		expect(service.getSnapshot().blinksPerMinute).toBe(1);

		service.recordBlink();
		service.recordBlink();
		expect(service.getSnapshot().blinksPerMinute).toBe(3);

		vi.advanceTimersByTime(60_001);
		expect(service.getSnapshot().blinksPerMinute).toBe(0);

		service.onTrackingStart();
		service.recordBlink();
		vi.advanceTimersByTime(1_000);
		push.mockClear();
		// Stable BPM must not spam full snapshot IPC every tick.
		vi.advanceTimersByTime(5_000);
		expect(push).not.toHaveBeenCalled();
		expect(service.getSnapshot().blinksPerMinute).toBe(1);

		// When a blink ages out of the window, BPM changes → one push.
		vi.advanceTimersByTime(55_000);
		expect(push).toHaveBeenCalled();
		expect(service.getSnapshot().blinksPerMinute).toBe(0);

		service.reset();
		expect(service.getSnapshot().blinksPerMinute).toBe(0);
		service.dispose();
	});
});
