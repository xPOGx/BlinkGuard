import { describe, expect, it } from "vitest";
import {
	isNearFullscreenCover,
	parseProbeBounds,
} from "../../../electron/infrastructure/focus/fullscreen-geometry";

describe("fullscreen-geometry", () => {
	const display = { x: 0, y: 0, width: 1920, height: 1080 };

	it("accepts near-full cover within margin", () => {
		expect(
			isNearFullscreenCover({ x: 0, y: 0, width: 1920, height: 1080 }, display),
		).toBe(true);
		expect(
			isNearFullscreenCover(
				{ x: 10, y: 10, width: 1900, height: 1060 },
				display,
			),
		).toBe(true);
	});

	it("rejects insufficient cover or large margins", () => {
		expect(
			isNearFullscreenCover({ x: 0, y: 0, width: 1280, height: 720 }, display),
		).toBe(false);
		expect(
			isNearFullscreenCover(
				{ x: 200, y: 0, width: 1720, height: 1080 },
				display,
			),
		).toBe(false);
	});

	it("rejects empty bounds", () => {
		expect(
			isNearFullscreenCover({ x: 0, y: 0, width: 0, height: 1080 }, display),
		).toBe(false);
	});

	it("parses probe lines", () => {
		expect(parseProbeBounds("0")).toBeNull();
		expect(parseProbeBounds("F")).toBeNull();
		expect(parseProbeBounds("1|42|0|0|1920|1080")).toEqual({
			x: 0,
			y: 0,
			width: 1920,
			height: 1080,
		});
		expect(parseProbeBounds("1|bad")).toBeNull();
	});
});
