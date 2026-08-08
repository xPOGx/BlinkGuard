import { t } from "./t";
import type { Locale } from "./types";

const WEEKDAY_KEYS = [
	"stats.weekday.mon",
	"stats.weekday.tue",
	"stats.weekday.wed",
	"stats.weekday.thu",
	"stats.weekday.fri",
	"stats.weekday.sat",
	"stats.weekday.sun",
] as const;

const MONTH_KEYS = [
	"stats.month.jan",
	"stats.month.feb",
	"stats.month.mar",
	"stats.month.apr",
	"stats.month.may",
	"stats.month.jun",
	"stats.month.jul",
	"stats.month.aug",
	"stats.month.sep",
	"stats.month.oct",
	"stats.month.nov",
	"stats.month.dec",
] as const;

export function weekdayLabels(locale: Locale): string[] {
	return WEEKDAY_KEYS.map((key) => t(locale, key));
}

export function monthLabels(locale: Locale): string[] {
	return MONTH_KEYS.map((key) => t(locale, key));
}
