import type { Locale } from "./types";

/** Suffix for catalog keys: "" (one), "_few" (uk 2–4), "_plural" (many / en ≠1). */
export type PluralSuffix = "" | "_few" | "_plural";

/**
 * Ukrainian: one / few / many (CLDR).
 * English: one when n===1, else many (`_plural`).
 */
export function pluralSuffix(locale: Locale, n: number): PluralSuffix {
	const value = Math.trunc(Math.abs(n));
	if (locale !== "uk") {
		return value === 1 ? "" : "_plural";
	}
	const mod100 = value % 100;
	const mod10 = value % 10;
	if (mod10 === 1 && mod100 !== 11) return "";
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
		return "_few";
	}
	return "_plural";
}

/** Build a key like `reminders.snoozeDesc` + suffix. */
export function pluralKey(base: string, locale: Locale, n: number): string {
	return `${base}${pluralSuffix(locale, n)}`;
}
