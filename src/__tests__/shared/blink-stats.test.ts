import { describe, expect, it } from "vitest";
import {
	addTrackingMs,
	availableBlinks,
	DEFAULT_BLINK_STATS,
	emptyDayStats,
	formatTrackingDuration,
	localDateKey,
	localHour,
	normalizeBlinkStatsState,
	pruneDays,
	recordBlink,
	recordSessionStart,
	shiftDateKey,
	spendBlinks,
	toDayChart,
	todaySummary,
	toMonthChart,
	totalsSummary,
	toWeekChart,
	toYearChart,
} from "../../../shared/blink-stats";

function withDays(
	days: ReturnType<typeof emptyDayStats>[],
	totals: { totalBlinks?: number; spentBlinks?: number } = {},
) {
	return {
		...DEFAULT_BLINK_STATS,
		days,
		totalBlinks:
			totals.totalBlinks ?? days.reduce((sum, day) => sum + day.blinks, 0),
		spentBlinks: totals.spentBlinks ?? 0,
	};
}

describe("blink-stats helpers", () => {
	it("formats local date keys and hours", () => {
		const noon = new Date(2026, 7, 7, 12, 30, 0);
		expect(localDateKey(noon)).toBe("2026-08-07");
		expect(localHour(noon)).toBe(12);
		expect(shiftDateKey("2026-08-07", -1)).toBe("2026-08-06");
	});

	it("records blinks into the correct hourly bucket and lifetime total", () => {
		const now = new Date(2026, 7, 7, 14, 0, 0);
		const state = recordBlink(DEFAULT_BLINK_STATS, now);
		expect(todaySummary(state, "2026-08-07")).toEqual({
			date: "2026-08-07",
			blinks: 1,
			trackingMs: 0,
			sessions: 0,
		});
		expect(toDayChart(state, "2026-08-07")[14]?.value).toBe(1);
		expect(totalsSummary(state)).toEqual({
			total: 1,
			spent: 0,
			available: 1,
		});
	});

	it("keeps lifetime total when pruned days drop off", () => {
		const today = "2026-08-07";
		let state = recordBlink(
			DEFAULT_BLINK_STATS,
			new Date(2026, 7, 7, 10, 0, 0),
		);
		state = {
			...state,
			days: [
				{ ...emptyDayStats(shiftDateKey(today, -400)), blinks: 0 },
				...state.days,
			],
			totalBlinks: 42,
		};
		const pruned = pruneDays(state, 366, today);
		expect(pruned.days.map((day) => day.date)).toEqual([today]);
		expect(pruned.totalBlinks).toBe(42);
		expect(availableBlinks(pruned)).toBe(42);
	});

	it("spendBlinks deducts from available and rejects overspend", () => {
		const state = withDays([{ ...emptyDayStats("2026-08-07"), blinks: 10 }], {
			totalBlinks: 10,
		});
		const spent = spendBlinks(state, 3);
		expect(spent).toEqual({
			...state,
			spentBlinks: 3,
		});
		expect(totalsSummary(spent ?? DEFAULT_BLINK_STATS)).toEqual({
			total: 10,
			spent: 3,
			available: 7,
		});
		expect(spendBlinks(spent ?? DEFAULT_BLINK_STATS, 8)).toBeNull();
		expect(spendBlinks(state, 0)).toBeNull();
	});

	it("accumulates tracking time and sessions", () => {
		const now = new Date(2026, 7, 7, 9, 0, 0);
		let state = recordSessionStart(DEFAULT_BLINK_STATS, now);
		state = addTrackingMs(state, 90_000, now);
		expect(todaySummary(state, "2026-08-07")).toMatchObject({
			blinks: 0,
			trackingMs: 90_000,
			sessions: 1,
		});
		expect(formatTrackingDuration(90_000)).toBe("1m");
		expect(formatTrackingDuration(3_660_000)).toBe("1h 1m");
	});

	it("builds a Mon–Sun week chart with gaps filled as zero", () => {
		const today = "2026-08-07";
		let state = recordBlink(
			DEFAULT_BLINK_STATS,
			new Date(2026, 7, 7, 10, 0, 0),
		);
		state = recordBlink(state, new Date(2026, 7, 5, 10, 0, 0));
		const week = toWeekChart(state, today);
		expect(week.map((bucket) => bucket.label)).toEqual([
			"Пн",
			"Вт",
			"Ср",
			"Чт",
			"Пт",
			"Сб",
			"Нд",
		]);
		expect(week.map((bucket) => bucket.value)).toEqual([0, 0, 1, 0, 1, 0, 0]);
	});

	it("builds a year chart with monthly blink totals", () => {
		const today = "2026-08-07";
		const state = withDays([
			{ ...emptyDayStats("2026-01-15"), blinks: 2 },
			{ ...emptyDayStats("2026-01-20"), blinks: 3 },
			{ ...emptyDayStats("2026-08-07"), blinks: 4 },
			{ ...emptyDayStats("2025-12-31"), blinks: 99 },
		]);
		const year = toYearChart(state, today);
		expect(year.map((bucket) => bucket.label)).toEqual([
			"Січ",
			"Лют",
			"Бер",
			"Кві",
			"Тра",
			"Чер",
			"Лип",
			"Сер",
			"Вер",
			"Жов",
			"Лис",
			"Гру",
		]);
		expect(year[0]?.value).toBe(5);
		expect(year[7]?.value).toBe(4);
		expect(year.map((bucket) => bucket.value)).toEqual([
			5, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0,
		]);
	});

	it("builds a month chart with one bar per calendar day", () => {
		const august = toMonthChart(
			withDays([
				{ ...emptyDayStats("2026-08-01"), blinks: 2 },
				{ ...emptyDayStats("2026-08-31"), blinks: 5 },
				{ ...emptyDayStats("2026-07-31"), blinks: 9 },
			]),
			"2026-08-07",
		);
		expect(august).toHaveLength(31);
		expect(august[0]).toEqual({ label: "1", value: 2 });
		expect(august[30]).toEqual({ label: "31", value: 5 });
		expect(august[6]?.value).toBe(0);

		const february = toMonthChart(DEFAULT_BLINK_STATS, "2026-02-10");
		expect(february).toHaveLength(28);
		expect(february[0]?.label).toBe("1");
		expect(february[27]?.label).toBe("28");
	});

	it("prunes days outside retention", () => {
		const today = "2026-08-07";
		const state = withDays(
			[emptyDayStats(shiftDateKey(today, -400)), emptyDayStats(today)],
			{ totalBlinks: 5 },
		);
		const pruned = pruneDays(state, 366, today);
		expect(pruned.days.map((day) => day.date)).toEqual([today]);
		expect(pruned.totalBlinks).toBe(5);
	});

	it("normalizes corrupt persisted payloads and seeds total from days", () => {
		expect(normalizeBlinkStatsState(null)).toEqual(DEFAULT_BLINK_STATS);
		const normalized = normalizeBlinkStatsState({
			days: [
				{ date: "bad", blinks: 3 },
				{
					date: "2026-08-07",
					blinks: 2.7,
					trackingMs: -5,
					sessions: 1,
					hourlyBlinks: [1, "x"],
				},
			],
		});
		expect(normalized.days).toHaveLength(1);
		expect(normalized.days[0]).toMatchObject({
			date: "2026-08-07",
			blinks: 2,
			trackingMs: 0,
			sessions: 1,
		});
		expect(normalized.days[0]?.hourlyBlinks).toHaveLength(24);
		expect(normalized.days[0]?.hourlyBlinks[0]).toBe(1);
		expect(normalized.days[0]?.hourlyBlinks[1]).toBe(0);
		expect(normalized.totalBlinks).toBe(2);
		expect(normalized.spentBlinks).toBe(0);
	});
});
