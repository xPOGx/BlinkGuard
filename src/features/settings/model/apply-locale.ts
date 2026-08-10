import {
	defaultExercisePrompts,
	defaultLookAwayHint,
	defaultLookAwayTitle,
	defaultPopupMessage,
	isBuiltInExercisePrompts,
	isBuiltInLookAwayHint,
	isBuiltInLookAwayTitle,
	isBuiltInPopupMessage,
	type Locale,
} from "../../../../shared/i18n";
import type { SettingsPreferences } from "./preferences";

/** Apply locale and rewrite built-in popup/exercise/look-away copy when still default. */
export function applyLocale(
	current: SettingsPreferences,
	locale: Locale,
): SettingsPreferences {
	const next: SettingsPreferences = {
		...current,
		locale,
	};
	if (isBuiltInPopupMessage(current.popupMessage)) {
		next.popupMessage = defaultPopupMessage(locale);
	}
	if (isBuiltInExercisePrompts(current.exercisePrompts)) {
		next.exercisePrompts = defaultExercisePrompts(locale);
	}
	if (isBuiltInLookAwayTitle(current.lookAwayTitle)) {
		next.lookAwayTitle = defaultLookAwayTitle(locale);
	}
	if (isBuiltInLookAwayHint(current.lookAwayHint)) {
		next.lookAwayHint = defaultLookAwayHint(locale);
	}
	return next;
}
