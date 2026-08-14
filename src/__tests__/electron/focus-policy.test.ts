import { describe, expect, it } from "vitest";
import {
	foregroundMatchesAppRules,
	isInQuietHours,
	isValidQuietHoursTime,
	matchesPauseAppRule,
	normalizeQuietHoursTime,
	parseQuietHoursMinutes,
	resolveFocusPauseReason,
	shouldSuppressNotifications,
} from "../../../electron/domain/focus-policy";

describe("quiet hours parsing", () => {
	it("parses valid HH:mm into minutes since midnight", () => {
		expect(parseQuietHoursMinutes("22:00")).toBe(22 * 60);
		expect(parseQuietHoursMinutes("08:30")).toBe(8 * 60 + 30);
		expect(parseQuietHoursMinutes("0:05")).toBe(5);
	});

	it("rejects invalid times", () => {
		expect(isValidQuietHoursTime("24:00")).toBe(false);
		expect(isValidQuietHoursTime("12:60")).toBe(false);
		expect(isValidQuietHoursTime("noon")).toBe(false);
		expect(parseQuietHoursMinutes("")).toBeNull();
	});

	it("accepts optional seconds and normalizes to HH:mm", () => {
		expect(parseQuietHoursMinutes("22:00:00")).toBe(22 * 60);
		expect(normalizeQuietHoursTime("8:05")).toBe("08:05");
	});
});

describe("isInQuietHours", () => {
	it("handles same-day windows", () => {
		const noon = new Date(2026, 7, 7, 12, 0, 0);
		expect(isInQuietHours(noon, "09:00", "17:00")).toBe(true);
		expect(isInQuietHours(noon, "13:00", "17:00")).toBe(false);
	});

	it("handles overnight windows wrapping midnight", () => {
		const late = new Date(2026, 7, 7, 23, 0, 0);
		const early = new Date(2026, 7, 7, 7, 0, 0);
		const midday = new Date(2026, 7, 7, 12, 0, 0);
		expect(isInQuietHours(late, "22:00", "08:00")).toBe(true);
		expect(isInQuietHours(early, "22:00", "08:00")).toBe(true);
		expect(isInQuietHours(midday, "22:00", "08:00")).toBe(false);
	});

	it("treats equal start/end as an empty window", () => {
		const now = new Date(2026, 7, 7, 22, 0, 0);
		expect(isInQuietHours(now, "22:00", "22:00")).toBe(false);
	});

	it("uses half-open end bound", () => {
		const atEnd = new Date(2026, 7, 7, 8, 0, 0);
		expect(isInQuietHours(atEnd, "22:00", "08:00")).toBe(false);
	});
});

describe("resolveFocusPauseReason", () => {
	it("prefers quiet hours over fullscreen", () => {
		expect(
			resolveFocusPauseReason({
				quietHoursEnabled: true,
				inQuietHours: true,
				pauseOnFullscreen: true,
				isFullscreen: true,
				appRuleMatched: true,
			}),
		).toBe("quiet-hours");
	});

	it("returns fullscreen when only that gate trips", () => {
		expect(
			resolveFocusPauseReason({
				quietHoursEnabled: true,
				inQuietHours: false,
				pauseOnFullscreen: true,
				isFullscreen: true,
				appRuleMatched: false,
			}),
		).toBe("fullscreen");
	});

	it("returns app-rule after quiet hours and fullscreen", () => {
		expect(
			resolveFocusPauseReason({
				quietHoursEnabled: true,
				inQuietHours: false,
				pauseOnFullscreen: true,
				isFullscreen: false,
				appRuleMatched: true,
			}),
		).toBe("app-rule");
		expect(
			resolveFocusPauseReason({
				quietHoursEnabled: false,
				inQuietHours: false,
				pauseOnFullscreen: true,
				isFullscreen: true,
				appRuleMatched: true,
			}),
		).toBe("fullscreen");
	});

	it("respects disabled toggles", () => {
		expect(
			shouldSuppressNotifications({
				quietHoursEnabled: false,
				inQuietHours: true,
				pauseOnFullscreen: false,
				isFullscreen: true,
				appRuleMatched: false,
			}),
		).toBe(false);
	});
});

describe("pause app-rule matching", () => {
	const zoom = { processName: "Zoom.exe", windowTitle: "Zoom Meeting" };

	it("matches process-only substring and ignores .exe", () => {
		expect(
			matchesPauseAppRule({ processName: "zoom", windowTitle: "" }, zoom),
		).toBe(true);
		expect(
			matchesPauseAppRule(
				{ processName: "ZOOM.EXE", windowTitle: "" },
				{
					processName: "zoom",
					windowTitle: "",
				},
			),
		).toBe(true);
	});

	it("matches title-only substring case-insensitively", () => {
		expect(
			matchesPauseAppRule({ processName: "", windowTitle: "meeting" }, zoom),
		).toBe(true);
		expect(
			matchesPauseAppRule({ processName: "", windowTitle: "Teams" }, zoom),
		).toBe(false);
	});

	it("requires both fields when both are set", () => {
		expect(
			matchesPauseAppRule(
				{ processName: "zoom", windowTitle: "Meeting" },
				zoom,
			),
		).toBe(true);
		expect(
			matchesPauseAppRule({ processName: "zoom", windowTitle: "Teams" }, zoom),
		).toBe(false);
		expect(
			matchesPauseAppRule(
				{ processName: "chrome", windowTitle: "Meeting" },
				zoom,
			),
		).toBe(false);
	});

	it("compares process basename and misses empty rules", () => {
		expect(
			matchesPauseAppRule(
				{ processName: "Zoom.exe", windowTitle: "" },
				{
					processName: "C:/Program Files/Zoom/Zoom.exe",
					windowTitle: "",
				},
			),
		).toBe(true);
		expect(
			matchesPauseAppRule(
				{ processName: "zoom", windowTitle: "" },
				{
					processName: "",
					windowTitle: "Zoom Meeting",
				},
			),
		).toBe(false);
		expect(
			matchesPauseAppRule({ processName: "", windowTitle: "" }, zoom),
		).toBe(false);
		expect(foregroundMatchesAppRules([], zoom)).toBe(false);
		expect(
			foregroundMatchesAppRules(
				[{ processName: "discord", windowTitle: "" }],
				zoom,
			),
		).toBe(false);
	});
});
