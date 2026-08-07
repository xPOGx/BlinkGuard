export const BLINK_STATS_RETENTION_DAYS = 366;
export const BLINK_STATS_STORE_KEY = "state";

export type DayBlinkStats = {
	date: string;
	blinks: number;
	trackingMs: number;
	sessions: number;
	hourlyBlinks: number[];
};

export type BlinkStatsState = {
	days: DayBlinkStats[];
	/** Lifetime credited blinks (survives day retention prune). */
	totalBlinks: number;
	/** Blinks spent on future rewards/features. */
	spentBlinks: number;
};

export type ChartBucket = {
	label: string;
	value: number;
};

export type TodayBlinkSummary = {
	date: string;
	blinks: number;
	trackingMs: number;
	sessions: number;
};

export type BlinkTotalsSummary = {
	/** Lifetime earned blinks. */
	total: number;
	/** Already spent. */
	spent: number;
	/** total - spent; available to spend later. */
	available: number;
};

export const DEFAULT_BLINK_STATS: BlinkStatsState = {
	days: [],
	totalBlinks: 0,
	spentBlinks: 0,
};

export function emptyHourlyBlinks(): number[] {
	return Array.from({ length: 24 }, () => 0);
}

export function emptyDayStats(date: string): DayBlinkStats {
	return {
		date,
		blinks: 0,
		trackingMs: 0,
		sessions: 0,
		hourlyBlinks: emptyHourlyBlinks(),
	};
}

/** Local calendar date as YYYY-MM-DD. */
export function localDateKey(now: Date = new Date()): string {
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

export function localHour(now: Date = new Date()): number {
	return now.getHours();
}

function cloneDay(day: DayBlinkStats): DayBlinkStats {
	return {
		...day,
		hourlyBlinks: [...day.hourlyBlinks],
	};
}

function cloneState(state: BlinkStatsState): BlinkStatsState {
	return {
		days: state.days.map(cloneDay),
		totalBlinks: state.totalBlinks,
		spentBlinks: state.spentBlinks,
	};
}

export function ensureDay(
	state: BlinkStatsState,
	date: string,
): BlinkStatsState {
	const next = cloneState(state);
	const index = next.days.findIndex((day) => day.date === date);
	if (index === -1) {
		next.days.push(emptyDayStats(date));
		next.days.sort((a, b) => a.date.localeCompare(b.date));
	}
	return next;
}

export function pruneDays(
	state: BlinkStatsState,
	retentionDays = BLINK_STATS_RETENTION_DAYS,
	today: string = localDateKey(),
): BlinkStatsState {
	const cutoff = shiftDateKey(today, -(retentionDays - 1));
	return {
		days: state.days
			.filter((day) => day.date >= cutoff)
			.sort((a, b) => a.date.localeCompare(b.date)),
		totalBlinks: state.totalBlinks,
		spentBlinks: state.spentBlinks,
	};
}

export function recordBlink(
	state: BlinkStatsState,
	now: Date = new Date(),
): BlinkStatsState {
	const date = localDateKey(now);
	const hour = localHour(now);
	let next = ensureDay(state, date);
	next = cloneState(next);
	const day = next.days.find((entry) => entry.date === date);
	if (!day) return pruneDays(next);
	day.blinks += 1;
	if (hour >= 0 && hour < 24) {
		day.hourlyBlinks[hour] += 1;
	}
	next.totalBlinks += 1;
	return pruneDays(next, BLINK_STATS_RETENTION_DAYS, date);
}

export function addTrackingMs(
	state: BlinkStatsState,
	ms: number,
	now: Date = new Date(),
): BlinkStatsState {
	if (ms <= 0) return state;
	const date = localDateKey(now);
	let next = ensureDay(state, date);
	next = cloneState(next);
	const day = next.days.find((entry) => entry.date === date);
	if (!day) return pruneDays(next);
	day.trackingMs += ms;
	return pruneDays(next, BLINK_STATS_RETENTION_DAYS, date);
}

export function recordSessionStart(
	state: BlinkStatsState,
	now: Date = new Date(),
): BlinkStatsState {
	const date = localDateKey(now);
	let next = ensureDay(state, date);
	next = cloneState(next);
	const day = next.days.find((entry) => entry.date === date);
	if (!day) return pruneDays(next);
	day.sessions += 1;
	return pruneDays(next, BLINK_STATS_RETENTION_DAYS, date);
}

export function availableBlinks(state: BlinkStatsState): number {
	return Math.max(0, state.totalBlinks - state.spentBlinks);
}

export function totalsSummary(state: BlinkStatsState): BlinkTotalsSummary {
	return {
		total: state.totalBlinks,
		spent: state.spentBlinks,
		available: availableBlinks(state),
	};
}

/**
 * Stub for future rewards: deduct from the spendable balance.
 * Returns null when amount is invalid or exceeds available.
 */
export function spendBlinks(
	state: BlinkStatsState,
	amount: number,
): BlinkStatsState | null {
	if (!Number.isFinite(amount) || amount <= 0) return null;
	const spend = Math.floor(amount);
	if (spend > availableBlinks(state)) return null;
	const next = cloneState(state);
	next.spentBlinks += spend;
	return next;
}

export function todaySummary(
	state: BlinkStatsState,
	today: string = localDateKey(),
): TodayBlinkSummary {
	const day = state.days.find((entry) => entry.date === today);
	return {
		date: today,
		blinks: day?.blinks ?? 0,
		trackingMs: day?.trackingMs ?? 0,
		sessions: day?.sessions ?? 0,
	};
}

export function toDayChart(
	state: BlinkStatsState,
	today: string = localDateKey(),
): ChartBucket[] {
	const day = state.days.find((entry) => entry.date === today);
	const hours = day?.hourlyBlinks ?? emptyHourlyBlinks();
	return hours.map((value, hour) => ({
		label: String(hour).padStart(2, "0"),
		value,
	}));
}

export function toWeekChart(
	state: BlinkStatsState,
	today: string = localDateKey(),
): ChartBucket[] {
	const byDate = new Map(state.days.map((day) => [day.date, day.blinks]));
	const monday = startOfWeekMonday(today);
	return WEEKDAY_LABELS_MON_SUN.map((label, offset) => {
		const date = shiftDateKey(monday, offset);
		return {
			label,
			value: byDate.get(date) ?? 0,
		};
	});
}

export function toMonthChart(
	state: BlinkStatsState,
	today: string = localDateKey(),
): ChartBucket[] {
	const byDate = new Map(state.days.map((day) => [day.date, day.blinks]));
	const daysInMonth = daysInCalendarMonth(today);
	const yearMonth = today.slice(0, 7);
	const buckets: ChartBucket[] = [];
	for (let day = 1; day <= daysInMonth; day += 1) {
		const date = `${yearMonth}-${String(day).padStart(2, "0")}`;
		buckets.push({
			label: String(day),
			value: byDate.get(date) ?? 0,
		});
	}
	return buckets;
}

export function toYearChart(
	state: BlinkStatsState,
	today: string = localDateKey(),
): ChartBucket[] {
	const year = today.slice(0, 4);
	const monthly = Array.from({ length: 12 }, () => 0);
	for (const day of state.days) {
		if (!day.date.startsWith(`${year}-`)) continue;
		const month = Number(day.date.slice(5, 7));
		if (month >= 1 && month <= 12) {
			monthly[month - 1] += day.blinks;
		}
	}
	return MONTH_LABELS_UA.map((label, index) => ({
		label,
		value: monthly[index] ?? 0,
	}));
}

/** Snapshot payload pushed to the settings renderer. */
export type BlinkStatsSnapshot = {
	today: TodayBlinkSummary;
	totals: BlinkTotalsSummary;
	dayChart: ChartBucket[];
	weekChart: ChartBucket[];
	monthChart: ChartBucket[];
	yearChart: ChartBucket[];
	/** Live credited blinks/min over the last rolling minute (ephemeral). */
	blinksPerMinute: number;
};

export function toBlinkStatsSnapshot(
	state: BlinkStatsState,
	now: Date = new Date(),
	blinksPerMinute = 0,
): BlinkStatsSnapshot {
	const today = localDateKey(now);
	return {
		today: todaySummary(state, today),
		totals: totalsSummary(state),
		dayChart: toDayChart(state, today),
		weekChart: toWeekChart(state, today),
		monthChart: toMonthChart(state, today),
		yearChart: toYearChart(state, today),
		blinksPerMinute,
	};
}

export function formatTrackingDuration(ms: number): string {
	const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours <= 0) return `${minutes}m`;
	return `${hours}h ${minutes}m`;
}

export function shiftDateKey(dateKey: string, dayOffset: number): string {
	const [year, month, day] = dateKey.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	date.setDate(date.getDate() + dayOffset);
	return localDateKey(date);
}

/** Monday of the ISO-style local week that contains `dateKey`. */
export function startOfWeekMonday(dateKey: string): string {
	const [year, month, day] = dateKey.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	const dayOfWeek = date.getDay(); // 0 Sun … 6 Sat
	const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
	date.setDate(date.getDate() - daysFromMonday);
	return localDateKey(date);
}

/** Number of days in the local calendar month that contains `dateKey`. */
export function daysInCalendarMonth(dateKey: string): number {
	const [year, month] = dateKey.split("-").map(Number);
	return new Date(year, month, 0).getDate();
}

const WEEKDAY_LABELS_MON_SUN = [
	"Пн",
	"Вт",
	"Ср",
	"Чт",
	"Пт",
	"Сб",
	"Нд",
] as const;

const MONTH_LABELS_UA = [
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
] as const;

function nonNegativeInt(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) return null;
	return Math.max(0, Math.floor(value));
}

export function normalizeBlinkStatsState(raw: unknown): BlinkStatsState {
	if (!raw || typeof raw !== "object") return { ...DEFAULT_BLINK_STATS };
	const record = raw as Record<string, unknown>;
	const daysRaw = record.days;
	if (!Array.isArray(daysRaw)) return { ...DEFAULT_BLINK_STATS };

	const days: DayBlinkStats[] = [];
	for (const entry of daysRaw) {
		if (!entry || typeof entry !== "object") continue;
		const day = entry as Record<string, unknown>;
		if (typeof day.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day.date)) {
			continue;
		}
		const hourly = Array.isArray(day.hourlyBlinks)
			? day.hourlyBlinks.map((value) =>
					typeof value === "number" && Number.isFinite(value)
						? Math.max(0, Math.floor(value))
						: 0,
				)
			: emptyHourlyBlinks();
		while (hourly.length < 24) hourly.push(0);
		days.push({
			date: day.date,
			blinks: nonNegativeInt(day.blinks) ?? 0,
			trackingMs: nonNegativeInt(day.trackingMs) ?? 0,
			sessions: nonNegativeInt(day.sessions) ?? 0,
			hourlyBlinks: hourly.slice(0, 24),
		});
	}

	const daysSum = days.reduce((sum, day) => sum + day.blinks, 0);
	const totalBlinks = nonNegativeInt(record.totalBlinks) ?? daysSum;
	let spentBlinks = nonNegativeInt(record.spentBlinks) ?? 0;
	if (spentBlinks > totalBlinks) spentBlinks = totalBlinks;

	return pruneDays({
		days,
		totalBlinks: Math.max(totalBlinks, daysSum),
		spentBlinks,
	});
}
