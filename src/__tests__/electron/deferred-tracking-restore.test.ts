import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	DeferredTrackingRestore,
	TRACKING_RESTORE_FALLBACK_MS,
} from "../../../electron/application/deferred-tracking-restore";

describe("DeferredTrackingRestore", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("does not start when pending is false", () => {
		const start = vi.fn();
		const restore = new DeferredTrackingRestore({
			pending: false,
			isTracking: () => true,
			start,
		});
		restore.armFallback();
		restore.onShellReady();
		vi.advanceTimersByTime(TRACKING_RESTORE_FALLBACK_MS);
		expect(start).not.toHaveBeenCalled();
		expect(restore.isPending).toBe(false);
	});

	it("starts once on shell ready when still tracking", () => {
		const start = vi.fn();
		const restore = new DeferredTrackingRestore({
			pending: true,
			isTracking: () => true,
			start,
		});
		restore.armFallback();
		expect(restore.isPending).toBe(true);
		restore.onShellReady();
		expect(start).toHaveBeenCalledTimes(1);
		expect(restore.isPending).toBe(false);
		restore.onShellReady();
		vi.advanceTimersByTime(TRACKING_RESTORE_FALLBACK_MS);
		expect(start).toHaveBeenCalledTimes(1);
	});

	it("skips start when tracking was cleared before shell ready", () => {
		let tracking = true;
		const start = vi.fn();
		const restore = new DeferredTrackingRestore({
			pending: true,
			isTracking: () => tracking,
			start,
		});
		restore.armFallback();
		tracking = false;
		restore.onShellReady();
		expect(start).not.toHaveBeenCalled();
		expect(restore.isPending).toBe(false);
	});

	it("falls back to start after timeout if shell never signals", () => {
		const start = vi.fn();
		const restore = new DeferredTrackingRestore({
			pending: true,
			isTracking: () => true,
			start,
			fallbackMs: 1_000,
		});
		restore.armFallback();
		vi.advanceTimersByTime(999);
		expect(start).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(start).toHaveBeenCalledTimes(1);
	});

	it("cancels fallback when shell ready fires first", () => {
		const start = vi.fn();
		const restore = new DeferredTrackingRestore({
			pending: true,
			isTracking: () => true,
			start,
			fallbackMs: 5_000,
		});
		restore.armFallback();
		restore.onShellReady();
		expect(start).toHaveBeenCalledTimes(1);
		vi.advanceTimersByTime(5_000);
		expect(start).toHaveBeenCalledTimes(1);
	});
});
