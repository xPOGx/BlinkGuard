import { describe, expect, it } from "vitest";
import {
	defaultExercisePrompts,
	defaultLookAwayHint,
	defaultLookAwayTitle,
	defaultPopupMessage,
	getCatalog,
	pluralKey,
	pluralSuffix,
	resolveCatalog,
	resolveExercisePrompts,
	resolveLookAwayHint,
	resolveLookAwayTitle,
	resolvePopupMessage,
	sanitizeLocale,
	t,
	type Locale,
} from "../../../shared/i18n";
import { en } from "../../../shared/i18n/en";
import { uk } from "../../../shared/i18n/uk";
import {
	sanitizeExercisePrompts,
	sanitizeLookAwayHint,
	sanitizeLookAwayTitle,
} from "../../../shared/preferences";

describe("i18n t()", () => {
	it("returns Ukrainian copy for known keys", () => {
		expect(t("uk", "app.section.reminders")).toBe("Нагадування");
		expect(t("uk", "defaults.popupMessage")).toBe("Моргни!");
	});

	it("falls back to English when a UK key is missing", () => {
		expect(t("uk", "this.key.does.not.exist.anywhere")).toBe(
			"this.key.does.not.exist.anywhere",
		);
		expect(t("uk", "app.tagline")).not.toBe("app.tagline");
		expect(t("en", "app.tagline")).toBe("Eye care settings");
	});

	it("localizes shared click-through and eye-care tray snooze", () => {
		expect(t("en", "popup.clickThrough")).toContain("reminder popups");
		expect(t("uk", "popup.clickThrough")).toContain("попапи");
		expect(t("en", "tray.snoozeExercise", { n: 5 })).toContain("5");
		expect(t("uk", "tray.snoozeLookAway", { n: 2 })).toContain("2");
		expect(t("en", "session.paused")).toBe("Paused: screen off");
		expect(t("uk", "session.paused")).toBe("Пауза: екран вимкнено");
	});

	it("interpolates variables", () => {
		expect(t("en", "reminders.snoozeDesc_plural", { n: 5 })).toBe(
			"Hide blink, exercise, and look-away prompts for 5 minutes after Snooze.",
		);
		expect(t("uk", "camera.cancelCalibration", { n: 3 })).toContain("3");
	});

	it("uses correct Ukrainian second/minute forms", () => {
		expect(t("uk", pluralKey("reminders.snoozeDesc", "uk", 1), { n: 1 })).toBe(
			"Ховати нагадування про моргання, вправи та погляд вдалину на 1 хвилину після «Відкласти».",
		);
		expect(t("uk", pluralKey("reminders.snoozeDesc", "uk", 2), { n: 2 })).toBe(
			"Ховати нагадування про моргання, вправи та погляд вдалину на 2 хвилини після «Відкласти».",
		);
		expect(t("uk", pluralKey("reminders.snoozeDesc", "uk", 5), { n: 5 })).toBe(
			"Ховати нагадування про моргання, вправи та погляд вдалину на 5 хвилин після «Відкласти».",
		);
	});
});

describe("Ukrainian pluralSuffix", () => {
	it("maps one / few / many", () => {
		expect(pluralSuffix("uk", 1)).toBe("");
		expect(pluralSuffix("uk", 2)).toBe("_few");
		expect(pluralSuffix("uk", 3)).toBe("_few");
		expect(pluralSuffix("uk", 4)).toBe("_few");
		expect(pluralSuffix("uk", 5)).toBe("_plural");
		expect(pluralSuffix("uk", 11)).toBe("_plural");
		expect(pluralSuffix("uk", 21)).toBe("");
		expect(pluralSuffix("en", 1)).toBe("");
		expect(pluralSuffix("en", 2)).toBe("_plural");
	});
});

describe("locale-aware defaults", () => {
	it("returns localized exercise prompts", () => {
		const en = defaultExercisePrompts("en");
		const uk = defaultExercisePrompts("uk");
		expect(en).toHaveLength(4);
		expect(uk).toHaveLength(4);
		expect(uk[0]).not.toBe(en[0]);
		expect(uk[0]).toContain("очі");
	});

	it("sanitizeExercisePrompts falls back to locale defaults", () => {
		expect(sanitizeExercisePrompts([], "uk")).toEqual(
			defaultExercisePrompts("uk"),
		);
		expect(sanitizeExercisePrompts(null, "en")).toEqual(
			defaultExercisePrompts("en"),
		);
	});

	it("sanitizeLocale rejects unknown values", () => {
		expect(sanitizeLocale("uk")).toBe("uk");
		expect(sanitizeLocale("de")).toBe("en");
		expect(sanitizeLocale(undefined)).toBe("en");
	});

	it("defaultPopupMessage follows locale", () => {
		expect(defaultPopupMessage("en")).toBe("Blink!");
		expect(defaultPopupMessage("uk")).toBe("Моргни!");
	});

	it("resolves built-in popup message to the active locale", () => {
		expect(resolvePopupMessage("Blink!", "uk")).toBe("Моргни!");
		expect(resolvePopupMessage("Моргни!", "en")).toBe("Blink!");
		expect(resolvePopupMessage("Custom!", "uk")).toBe("Custom!");
	});

	it("resolves built-in exercise prompts to the active locale", () => {
		const en = defaultExercisePrompts("en");
		expect(resolveExercisePrompts(en, "uk")).toEqual(
			defaultExercisePrompts("uk"),
		);
		expect(resolveExercisePrompts(["Custom"], "uk")).toEqual(["Custom"]);
	});

	it("defaultLookAway copy follows locale", () => {
		expect(defaultLookAwayTitle("en")).toBe("Look away");
		expect(defaultLookAwayTitle("uk")).toBe("Подивіться вдалину");
		expect(defaultLookAwayHint("en")).toContain("20 feet");
		expect(defaultLookAwayHint("uk")).toContain("6 м");
	});

	it("resolves built-in look-away copy to the active locale", () => {
		expect(resolveLookAwayTitle("Look away", "uk")).toBe("Подивіться вдалину");
		expect(resolveLookAwayTitle("Подивіться вдалину", "en")).toBe("Look away");
		expect(resolveLookAwayTitle("Custom title", "uk")).toBe("Custom title");
		expect(
			resolveLookAwayHint("Focus on something ~20 feet / 6 m away", "uk"),
		).toBe(defaultLookAwayHint("uk"));
		expect(resolveLookAwayHint("Custom hint", "uk")).toBe("Custom hint");
	});

	it("sanitizeLookAway title/hint fall back to locale defaults", () => {
		expect(sanitizeLookAwayTitle("", "uk")).toBe(defaultLookAwayTitle("uk"));
		expect(sanitizeLookAwayTitle("  ", "en")).toBe(defaultLookAwayTitle("en"));
		expect(sanitizeLookAwayTitle("  My title  ", "uk")).toBe("My title");
		expect(sanitizeLookAwayHint(null, "uk")).toBe(defaultLookAwayHint("uk"));
		expect(sanitizeLookAwayHint("  My hint  ", "en")).toBe("My hint");
	});
});

describe("i18n catalog parity", () => {
	it("has the same keys in en and uk catalogs", () => {
		expect(Object.keys(uk).sort()).toEqual(Object.keys(en).sort());
	});

	it("resolveCatalog fills every EN key for uk", () => {
		const catalog = resolveCatalog("uk");
		expect(Object.keys(catalog).sort()).toEqual(Object.keys(en).sort());
		expect(catalog["app.section.reminders"]).toBe("Нагадування");
		expect(catalog["app.tagline"]).toBe(t("uk", "app.tagline"));
	});

	it("getCatalog falls back to English for an unknown locale", () => {
		expect(getCatalog("uk")).toBe(uk);
		expect(getCatalog("de" as Locale)).toBe(en);
	});
});
