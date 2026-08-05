import { describe, expect, it } from "vitest";
import {
	DEFAULT_PREFERENCES,
	type AppPreferences,
	toRendererPreferences,
} from "../../../shared/preferences";

describe("toRendererPreferences", () => {
	it("converts reminderInterval from ms to seconds for the settings UI", () => {
		const preferences: AppPreferences = {
			...DEFAULT_PREFERENCES,
			reminderInterval: 4500,
			isTracking: true,
		};

		const renderer = toRendererPreferences(preferences);

		expect(renderer.reminderInterval).toBe(4.5);
		expect(renderer.isTracking).toBe(true);
		expect(renderer.popupMessage).toBe(DEFAULT_PREFERENCES.popupMessage);
	});
});
