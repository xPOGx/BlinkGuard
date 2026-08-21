import { describe, expect, it } from "vitest";
import { buildAlgorithmPrefs } from "../../../electron/infrastructure/logging/diagnostics-export";
import { DEFAULT_PREFERENCES } from "../../../shared/preferences";

describe("buildAlgorithmPrefs", () => {
	it("includes sanitized quietHoursByWeekday beside legacy quiet-hours fields", () => {
		const prefs = {
			...DEFAULT_PREFERENCES,
			quietHoursByWeekday: {
				sat: { mode: "off" as const },
				fri: { mode: "custom" as const, start: "22:00", end: "08:00" },
			},
		};
		const dump = buildAlgorithmPrefs(prefs);
		expect(dump.quietHoursEnabled).toBe(true);
		expect(dump.quietHoursStart).toBe("22:00");
		expect(dump.quietHoursEnd).toBe("08:00");
		expect(dump.quietHoursByWeekday).toEqual({
			sat: { mode: "off" },
			fri: { mode: "custom", start: "22:00", end: "08:00" },
		});
	});

	it("collapses hostile quietHoursByWeekday in the dump", () => {
		const prefs = {
			...DEFAULT_PREFERENCES,
			quietHoursByWeekday: {
				__proto__: { polluted: true },
				sat: { mode: "custom", start: "24:00", end: "08:00" },
				mon: { mode: "off" },
			} as never,
		};
		const dump = buildAlgorithmPrefs(prefs);
		expect(dump.quietHoursByWeekday).toEqual({ mon: { mode: "off" } });
	});
});
