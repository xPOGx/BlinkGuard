import { t } from "./t";
import { LOCALES, type Locale } from "./types";

const EXERCISE_PROMPT_KEYS = [
	"defaults.exercisePrompt1",
	"defaults.exercisePrompt2",
	"defaults.exercisePrompt3",
	"defaults.exercisePrompt4",
] as const;

export function defaultExercisePrompts(locale: Locale): string[] {
	return EXERCISE_PROMPT_KEYS.map((key) => t(locale, key));
}

export function defaultPopupMessage(locale: Locale): string {
	return t(locale, "defaults.popupMessage");
}

/** True when `message` matches a built-in default in any locale (not custom). */
export function isBuiltInPopupMessage(message: string): boolean {
	return LOCALES.some((locale) => defaultPopupMessage(locale) === message);
}

/** Use localized default when the stored message is still a built-in. */
export function resolvePopupMessage(stored: string, locale: Locale): string {
	return isBuiltInPopupMessage(stored)
		? defaultPopupMessage(locale)
		: stored;
}

export function defaultLookAwayTitle(locale: Locale): string {
	return t(locale, "defaults.lookAwayTitle");
}

export function defaultLookAwayHint(locale: Locale): string {
	return t(locale, "defaults.lookAwayHint");
}

/** True when title matches a built-in default in any locale (not custom). */
export function isBuiltInLookAwayTitle(title: string): boolean {
	return LOCALES.some((locale) => defaultLookAwayTitle(locale) === title);
}

/** True when hint matches a built-in default in any locale (not custom). */
export function isBuiltInLookAwayHint(hint: string): boolean {
	return LOCALES.some((locale) => defaultLookAwayHint(locale) === hint);
}

/** Use localized default when the stored title is still a built-in. */
export function resolveLookAwayTitle(stored: string, locale: Locale): string {
	return isBuiltInLookAwayTitle(stored)
		? defaultLookAwayTitle(locale)
		: stored;
}

/** Use localized default when the stored hint is still a built-in. */
export function resolveLookAwayHint(stored: string, locale: Locale): string {
	return isBuiltInLookAwayHint(stored)
		? defaultLookAwayHint(locale)
		: stored;
}

function samePromptList(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((item, index) => item === b[index]);
}

/** True when prompts exactly match a built-in default set in any locale. */
export function isBuiltInExercisePrompts(prompts: readonly string[]): boolean {
	return LOCALES.some((locale) =>
		samePromptList(prompts, defaultExercisePrompts(locale)),
	);
}

/** Use localized defaults when stored prompts are still a built-in set. */
export function resolveExercisePrompts(
	stored: readonly string[],
	locale: Locale,
): string[] {
	return isBuiltInExercisePrompts(stored)
		? defaultExercisePrompts(locale)
		: [...stored];
}
