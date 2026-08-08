/** Catalog of spendable blink rewards (costs in lifetime blinks). */

export const BLINK_REWARD_IDS = ["cheer", "statsFlair", "streakShield"] as const;

export type BlinkRewardId = (typeof BLINK_REWARD_IDS)[number];

export type BlinkRewardDefinition = {
	id: BlinkRewardId;
	cost: number;
	/** One-time unlock stored in unlockedRewardIds. */
	oneTime: boolean;
	/** Max streak-shield charges (only for streakShield). */
	maxCharges?: number;
};

/**
 * Costs tuned for camera tracking (~12–15 credited blinks/min):
 * Cheer ≈ 30–40 min, flair ≈ one workday, shield ≈ more than a day.
 */
export const BLINK_REWARDS: Record<BlinkRewardId, BlinkRewardDefinition> = {
	cheer: { id: "cheer", cost: 500, oneTime: false },
	statsFlair: { id: "statsFlair", cost: 5000, oneTime: true },
	streakShield: {
		id: "streakShield",
		cost: 8000,
		oneTime: false,
		maxCharges: 1,
	},
};

export function isBlinkRewardId(value: unknown): value is BlinkRewardId {
	return (
		typeof value === "string" &&
		(BLINK_REWARD_IDS as readonly string[]).includes(value)
	);
}
