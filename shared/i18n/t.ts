import { en } from "./en";
import type { Locale, MessageCatalog, TranslateVars } from "./types";
import { uk } from "./uk";

const CATALOGS: Record<Locale, MessageCatalog> = {
	en,
	uk,
};

function interpolate(template: string, vars?: TranslateVars): string {
	if (!vars) return template;
	return template.replace(/\{(\w+)\}/g, (match, name: string) => {
		const value = vars[name];
		return value === undefined ? match : String(value);
	});
}

/** Resolve a message key: locale → en → key. */
export function t(
	locale: Locale,
	key: string,
	vars?: TranslateVars,
): string {
	const primary = CATALOGS[locale]?.[key];
	const fallback = locale === "en" ? undefined : en[key];
	const template = primary ?? fallback ?? key;
	return interpolate(template, vars);
}

/** Flat catalog with every EN key resolved for `locale` (EN fallback per key). */
export function resolveCatalog(locale: Locale): Record<string, string> {
	const out: Record<string, string> = {};
	for (const key of Object.keys(en)) {
		out[key] = t(locale, key);
	}
	return out;
}

export function getCatalog(locale: Locale): MessageCatalog {
	return CATALOGS[locale] ?? en;
}
