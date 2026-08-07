import { describe, expect, it } from "vitest";
import {
	BLINK_RATE_WINDOW_MS,
	classifyBlinkRate,
	computeBlinksPerMinute,
	formatBlinksPerMinute,
	pruneBlinkTimestamps,
} from "../../../shared/blink-rate";

describe("blink-rate helpers", () => {
	const now = 1_000_000;

	it("returns 0 for an empty window", () => {
		expect(computeBlinksPerMinute([], now)).toBe(0);
		expect(computeBlinksPerMinute([now - BLINK_RATE_WINDOW_MS - 1], now)).toBe(
			0,
		);
	});

	it("scales blinks in the window to per-minute", () => {
		const timestamps = [now - 10_000, now - 5_000, now];
		expect(computeBlinksPerMinute(timestamps, now)).toBe(3);
	});

	it("prunes timestamps outside the rolling window", () => {
		const timestamps = [
			now - BLINK_RATE_WINDOW_MS - 1,
			now - 30_000,
			now,
			now + 1,
		];
		expect(pruneBlinkTimestamps(timestamps, now)).toEqual([now - 30_000, now]);
	});

	it("classifies low / ok / good from guidance bands", () => {
		expect(classifyBlinkRate(0).quality).toBe("low");
		expect(classifyBlinkRate(3.9).quality).toBe("low");
		expect(classifyBlinkRate(4).quality).toBe("ok");
		expect(classifyBlinkRate(14).quality).toBe("ok");
		expect(classifyBlinkRate(15).quality).toBe("good");
		expect(classifyBlinkRate(25).quality).toBe("good");
		expect(classifyBlinkRate(15).label).toBe("Good");
		expect(classifyBlinkRate(15).description).toContain("15–20");
	});

	it("formats display values", () => {
		expect(formatBlinksPerMinute(0)).toBe("0");
		expect(formatBlinksPerMinute(3)).toBe("3");
		expect(formatBlinksPerMinute(3.14)).toBe("3.1");
	});
});
