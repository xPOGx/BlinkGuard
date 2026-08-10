import { describe, expect, it } from "vitest";
import { applyLocale } from "@/features/settings/model/apply-locale";
import { DEFAULT_RENDERER_PREFERENCES } from "@/features/settings/model/preferences";
import {
	defaultExercisePrompts,
	defaultLookAwayHint,
	defaultLookAwayTitle,
	defaultPopupMessage,
} from "../../../shared/i18n";

describe("applyLocale", () => {
	it("rewrites built-in popup, exercise, and look-away copy", () => {
		const current = {
			...DEFAULT_RENDERER_PREFERENCES,
			locale: "en" as const,
			popupMessage: defaultPopupMessage("en"),
			exercisePrompts: defaultExercisePrompts("en"),
			lookAwayTitle: defaultLookAwayTitle("en"),
			lookAwayHint: defaultLookAwayHint("en"),
		};

		const next = applyLocale(current, "uk");

		expect(next.locale).toBe("uk");
		expect(next.popupMessage).toBe(defaultPopupMessage("uk"));
		expect(next.exercisePrompts).toEqual(defaultExercisePrompts("uk"));
		expect(next.lookAwayTitle).toBe(defaultLookAwayTitle("uk"));
		expect(next.lookAwayHint).toBe(defaultLookAwayHint("uk"));
	});

	it("leaves custom copy alone when switching locale", () => {
		const current = {
			...DEFAULT_RENDERER_PREFERENCES,
			locale: "en" as const,
			popupMessage: "Custom blink!",
			exercisePrompts: ["One", "Two", "Three", "Four"],
			lookAwayTitle: "Custom look",
			lookAwayHint: "Custom hint",
		};

		const next = applyLocale(current, "uk");

		expect(next.locale).toBe("uk");
		expect(next.popupMessage).toBe("Custom blink!");
		expect(next.exercisePrompts).toEqual(["One", "Two", "Three", "Four"]);
		expect(next.lookAwayTitle).toBe("Custom look");
		expect(next.lookAwayHint).toBe("Custom hint");
	});
});
