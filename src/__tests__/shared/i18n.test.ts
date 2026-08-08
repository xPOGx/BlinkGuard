import { describe, expect, it } from "vitest";
import {
	defaultExercisePrompts,
	defaultPopupMessage,
	pluralKey,
	pluralSuffix,
	resolveExercisePrompts,
	resolvePopupMessage,
	sanitizeLocale,
	t,
} from "../../../shared/i18n";
import { sanitizeExercisePrompts } from "../../../shared/preferences";

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

	it("interpolates variables", () => {
		expect(t("en", "reminders.desc.timer_plural", { n: 5 })).toBe(
			"Show reminder every 5 seconds",
		);
		expect(t("uk", "camera.cancelCalibration", { n: 3 })).toContain("3");
	});

	it("uses correct Ukrainian second/minute forms", () => {
		expect(t("uk", pluralKey("reminders.desc.timer", "uk", 1), { n: 1 })).toBe(
			"Показувати нагадування кожну 1 секунду",
		);
		expect(t("uk", pluralKey("reminders.desc.timer", "uk", 2), { n: 2 })).toBe(
			"Показувати нагадування кожні 2 секунди",
		);
		expect(t("uk", pluralKey("reminders.desc.timer", "uk", 5), { n: 5 })).toBe(
			"Показувати нагадування кожні 5 секунд",
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
});
