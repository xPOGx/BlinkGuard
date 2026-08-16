import { describe, expect, it } from "vitest";
import {
	MAX_PENDING_SOUND_JOBS,
	SoundPlayQueue,
} from "../../../electron/infrastructure/sound/sound-play-queue";

describe("SoundPlayQueue", () => {
	it("starts a job immediately when idle and does not queue it as pending", () => {
		const queue = new SoundPlayQueue<string>();
		const result = queue.enqueue("a");
		expect(result).toEqual({ started: true, dropped: [] });
		expect(queue.isPlaying).toBe(true);
		expect(queue.current).toBe("a");
		expect(queue.pendingCount).toBe(0);
	});

	it("queues a job when already playing", () => {
		const queue = new SoundPlayQueue<string>();
		queue.enqueue("a");
		const result = queue.enqueue("b");
		expect(result).toEqual({ started: false, dropped: [] });
		expect(queue.current).toBe("a");
		expect(queue.pendingCount).toBe(1);
	});

	it("finish() clears playing and starts the next pending job", () => {
		const queue = new SoundPlayQueue<string>();
		queue.enqueue("a");
		queue.enqueue("b");
		queue.enqueue("c");
		expect(queue.finish()).toBe("b");
		expect(queue.current).toBe("b");
		expect(queue.pendingCount).toBe(1);
		expect(queue.finish()).toBe("c");
		expect(queue.finish()).toBeNull();
		expect(queue.isPlaying).toBe(false);
		expect(queue.pendingCount).toBe(0);
	});

	it("interruptPlaying() clears current only", () => {
		const queue = new SoundPlayQueue<string>();
		queue.enqueue("a");
		queue.enqueue("b");
		queue.interruptPlaying();
		expect(queue.isPlaying).toBe(false);
		expect(queue.current).toBeNull();
		expect(queue.pendingCount).toBe(1);
		expect(queue.finish()).toBe("b");
		expect(queue.current).toBe("b");
	});

	it("drops the oldest pending when the cap is exceeded", () => {
		const queue = new SoundPlayQueue<number>();
		queue.enqueue(0);
		for (let i = 1; i <= MAX_PENDING_SOUND_JOBS; i++) {
			expect(queue.enqueue(i).dropped).toEqual([]);
		}
		expect(queue.pendingCount).toBe(MAX_PENDING_SOUND_JOBS);
		const overflow = queue.enqueue(99);
		expect(overflow.started).toBe(false);
		expect(overflow.dropped).toEqual([1]);
		expect(queue.pendingCount).toBe(MAX_PENDING_SOUND_JOBS);
		expect(queue.current).toBe(0);
		expect(queue.finish()).toBe(2);
	});

	it("clear() empties playing and pending", () => {
		const queue = new SoundPlayQueue<string>();
		queue.enqueue("a");
		queue.enqueue("b");
		queue.clear();
		expect(queue.isPlaying).toBe(false);
		expect(queue.current).toBeNull();
		expect(queue.pendingCount).toBe(0);
		expect(queue.finish()).toBeNull();
	});
});
