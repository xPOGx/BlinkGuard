import {
	defaultExercisePrompts,
	defaultLookAwayHint,
	defaultLookAwayTitle,
	defaultPopupMessage,
	isBuiltInExercisePrompts,
	isBuiltInLookAwayHint,
	isBuiltInLookAwayTitle,
	isBuiltInPopupMessage,
	resolveExercisePrompts,
	resolveLookAwayHint,
	resolveLookAwayTitle,
	resolvePopupMessage,
} from "./defaults";
import { monthLabels, weekdayLabels } from "./labels";
import { pluralKey, pluralSuffix } from "./plural";
import { getCatalog, resolveCatalog, t } from "./t";
import {
	LOCALES,
	type Locale,
	type MessageCatalog,
	type TranslateVars,
} from "./types";

export function isLocale(value: unknown): value is Locale {
	return value === "en" || value === "uk";
}

export function sanitizeLocale(input: unknown): Locale {
	return isLocale(input) ? input : "en";
}

export type { Locale, MessageCatalog, TranslateVars };
export {
	LOCALES,
	defaultExercisePrompts,
	defaultLookAwayHint,
	defaultLookAwayTitle,
	defaultPopupMessage,
	getCatalog,
	isBuiltInExercisePrompts,
	isBuiltInLookAwayHint,
	isBuiltInLookAwayTitle,
	isBuiltInPopupMessage,
	monthLabels,
	pluralKey,
	pluralSuffix,
	resolveCatalog,
	resolveExercisePrompts,
	resolveLookAwayHint,
	resolveLookAwayTitle,
	resolvePopupMessage,
	t,
	weekdayLabels,
};
