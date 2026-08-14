import { describe, expect, it } from "vitest";
import {
	interpretForegroundSnapshot,
	isNearFullscreenCover,
	parseForegroundIdentity,
	parseProbeBounds,
	parseRunningAppListLine,
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
		expect(parseProbeBounds("1|42|0|0|1920|1080|Zoom.exe|Meeting")).toEqual({
			x: 0,
			y: 0,
			width: 1920,
			height: 1080,
		});
		expect(parseProbeBounds("1|bad")).toBeNull();
	});

	it("parses trailing process and title identity", () => {
		expect(parseForegroundIdentity("0")).toEqual({
			processName: null,
			windowTitle: null,
		});
		expect(parseForegroundIdentity("1|42|0|0|1920|1080")).toEqual({
			processName: null,
			windowTitle: null,
		});
		expect(parseForegroundIdentity("0|||Zoom.exe|Zoom Meeting")).toEqual({
			processName: "Zoom.exe",
			windowTitle: "Zoom Meeting",
		});
		expect(parseForegroundIdentity("F|||zoom.us|Zoom")).toEqual({
			processName: "zoom.us",
			windowTitle: "Zoom",
		});
		expect(
			parseForegroundIdentity("1|42|0|0|1920|1080|Zoom.exe|Meeting"),
		).toEqual({
			processName: "Zoom.exe",
			windowTitle: "Meeting",
		});
	});

	it("parses running-app list lines", () => {
		expect(parseRunningAppListLine("0")).toEqual([]);
		expect(parseRunningAppListLine("Lnot-json")).toEqual([]);
		expect(parseRunningAppListLine("L[]")).toEqual([]);
		expect(parseRunningAppListLine('L{"p":"Zoom.exe","t":"Meeting"}')).toEqual([
			{ processName: "Zoom.exe", windowTitle: "Meeting" },
		]);
		expect(
			parseRunningAppListLine(
				'L[{"p":"Zoom.exe","t":"Meeting"},{"p":"chrome.exe","t":""}]',
			),
		).toEqual([
			{ processName: "Zoom.exe", windowTitle: "Meeting" },
			{ processName: "chrome.exe", windowTitle: "" },
		]);
	});

	it("interprets probe lines into fullscreen snapshots", () => {
		const display = { x: 0, y: 0, width: 1920, height: 1080 };
		expect(interpretForegroundSnapshot("0", () => display)).toEqual({
			isFullscreen: false,
			processName: null,
			windowTitle: null,
		});
		expect(
			interpretForegroundSnapshot("F|||zoom.us|Zoom", () => display),
		).toEqual({
			isFullscreen: true,
			processName: "zoom.us",
			windowTitle: "Zoom",
		});
		expect(
			interpretForegroundSnapshot(
				"1|42|0|0|1920|1080|Zoom.exe|Meeting",
				() => display,
			),
		).toEqual({
			isFullscreen: true,
			processName: "Zoom.exe",
			windowTitle: "Meeting",
		});
	});
});
