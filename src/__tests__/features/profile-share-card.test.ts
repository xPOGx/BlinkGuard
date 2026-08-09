import { describe, expect, it } from "vitest";
import { resolveShareCardContent } from "../../features/profile/ui/profile-share-card";

describe("resolveShareCardContent", () => {
	it("keeps brand and level, omits empty optional fields", () => {
		const content = resolveShareCardContent({
			brand: "BlinkGuard",
			level: 3,
			levelLabel: "Level 3",
			title: null,
			tier: "  ",
			desc: undefined,
			stats: [
				{ label: "Lifetime", value: "10" },
				{ label: "Today", value: "2" },
			],
			flairLabel: "",
			dateLabel: "Aug 9, 2026",
			progressRatio: 0.5,
			progressCaption: "5 / 10 to next level",
			tagline: "Eye care",
			dark: false,
		});

		expect(content.brand).toBe("BlinkGuard");
		expect(content.levelLabel).toBe("Level 3");
		expect(content.title).toBeNull();
		expect(content.tier).toBeNull();
		expect(content.desc).toBeNull();
		expect(content.flair).toBeNull();
		expect(content.stats).toEqual([
			{ label: "Lifetime", value: "10" },
			{ label: "Today", value: "2" },
		]);
		expect(content.dateLabel).toBe("Aug 9, 2026");
		expect(content.progressRatio).toBe(0.5);
		expect(content.progressCaption).toBe("5 / 10 to next level");
		expect(content.tagline).toBe("Eye care");
	});

	it("clamps progress ratio and drops blank stats", () => {
		const content = resolveShareCardContent({
			brand: "BlinkGuard",
			level: 1,
			levelLabel: "Level 1",
			title: "Blink Newbie",
			tier: "Spark",
			desc: "A soft start.",
			stats: [
				{ label: "Lifetime", value: "1" },
				{ label: " ", value: "x" },
				{ label: "Streak", value: "1 days" },
			],
			flairLabel: "Steady Eyes",
			dateLabel: "today",
			progressRatio: 1.5,
			dark: true,
		});

		expect(content.title).toBe("Blink Newbie");
		expect(content.tier).toBe("Spark");
		expect(content.desc).toBe("A soft start.");
		expect(content.flair).toBe("Steady Eyes");
		expect(content.stats).toHaveLength(2);
		expect(content.progressRatio).toBe(1);
	});
});
