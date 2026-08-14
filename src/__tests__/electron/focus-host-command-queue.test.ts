import { describe, expect, it, vi } from "vitest";
import { FocusHostCommandQueue } from "../../../electron/infrastructure/focus/focus-host-command-queue";

describe("FocusHostCommandQueue", () => {
	it("sends the next command only after the current line arrives", async () => {
		const sent: string[] = [];
		const queue = new FocusHostCommandQueue();
		queue.attach((line) => {
			sent.push(line);
		});

		const first = queue.enqueue("c \n", 1000);
		const second = queue.enqueue("l \n", 1000);
		expect(sent).toEqual(["c \n"]);

		queue.onLine("0|||Zoom.exe|Meeting");
		await expect(first).resolves.toBe("0|||Zoom.exe|Meeting");
		expect(sent).toEqual(["c \n", "l \n"]);

		queue.onLine("L[]");
		await expect(second).resolves.toBe("L[]");
	});

	it("calls onStale and rejects when a command times out", async () => {
		vi.useFakeTimers();
		try {
			const onStale = vi.fn();
			const queue = new FocusHostCommandQueue(onStale);
			queue.attach(() => undefined);
			const pending = queue.enqueue("c \n", 1500);
			const assertion = expect(pending).rejects.toThrow("timed out");
			await vi.advanceTimersByTimeAsync(1500);
			await assertion;
			expect(onStale).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});
