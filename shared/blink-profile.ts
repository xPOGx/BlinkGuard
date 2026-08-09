/** Lifetime blinks needed to advance from level L → L+1 (≈ shop Cheer cost). */
export const PROFILE_LEVEL_BASE_COST = 500;
/** Exponential growth per level for profile XP costs. */
export const PROFILE_LEVEL_RATIO = 1.07;
/** Highest level with a unique title/description. */
export const PROFILE_TITLE_MAX_LEVEL = 100;
/** Number of display tiers (10 levels each for titled range). */
export const PROFILE_TIER_COUNT = 10;
/** Levels per tier chip. */
export const PROFILE_LEVELS_PER_TIER = 10;

export type ProfileLevelProgress = {
	/** Current unbounded level (≥ 1). */
	level: number;
	/** Blinks earned within the current level. */
	current: number;
	/** Blinks needed to finish the current level (cost of this level). */
	needed: number;
	/** 0…1 progress within the level. */
	ratio: number;
	/** Lifetime blinks required to reach the current level. */
	thresholdAtLevel: number;
	/** Lifetime blinks required to reach the next level. */
	thresholdAtNext: number;
};

/** Cost in blinks to go from `level` to `level + 1` (`level` ≥ 1). */
export function costToAdvanceFrom(level: number): number {
	const L = Math.max(1, Math.floor(level));
	return Math.round(PROFILE_LEVEL_BASE_COST * PROFILE_LEVEL_RATIO ** (L - 1));
}

/**
 * Cumulative lifetime blinks required to **reach** `level` (level ≥ 1).
 * `thresholdForLevel(1) === 0`.
 */
export function thresholdForLevel(level: number): number {
	const L = Math.max(1, Math.floor(level));
	if (L <= 1) return 0;
	let total = 0;
	for (let i = 1; i < L; i++) {
		total += costToAdvanceFrom(i);
	}
	return total;
}

/** Unbounded profile level from lifetime credited blinks (≥ 1). */
export function levelFromTotalBlinks(totalBlinks: number): number {
	const total = Math.max(0, Math.floor(totalBlinks));
	let level = 1;
	let spent = 0;
	for (;;) {
		const cost = costToAdvanceFrom(level);
		if (spent + cost > total) return level;
		spent += cost;
		level += 1;
		// Safety: avoid infinite loop on bad math (should never hit).
		if (level > 1_000_000) return level;
	}
}

/** Level used for title/description keys (capped at 100). */
export function titleLevel(level: number): number {
	return Math.min(PROFILE_TITLE_MAX_LEVEL, Math.max(1, Math.floor(level)));
}

/**
 * Tier index 1…10 for display chips.
 * Levels 1–10 → 1, …, 91–100 → 10; 101+ stay at 10.
 */
export function tierForLevel(level: number): number {
	const capped = titleLevel(level);
	return Math.min(
		PROFILE_TIER_COUNT,
		Math.ceil(capped / PROFILE_LEVELS_PER_TIER),
	);
}

export function progressToNextLevel(totalBlinks: number): ProfileLevelProgress {
	const total = Math.max(0, Math.floor(totalBlinks));
	const level = levelFromTotalBlinks(total);
	const thresholdAtLevel = thresholdForLevel(level);
	const needed = costToAdvanceFrom(level);
	const thresholdAtNext = thresholdAtLevel + needed;
	const current = Math.min(needed, Math.max(0, total - thresholdAtLevel));
	const ratio = needed <= 0 ? 1 : Math.min(1, current / needed);
	return {
		level,
		current,
		needed,
		ratio,
		thresholdAtLevel,
		thresholdAtNext,
	};
}

export function profileTitleKey(level: number): string {
	return `profile.level.${titleLevel(level)}.title`;
}

export function profileDescKey(level: number): string {
	return `profile.level.${titleLevel(level)}.desc`;
}

export function profileTierKey(level: number): string {
	return `profile.tier.${tierForLevel(level)}`;
}

/** Next titled milestone levels after `level` (up to `count`, capped at 100). */
export function upcomingTitleMilestones(
	level: number,
	count = 3,
): number[] {
	const start = Math.floor(level) + 1;
	const out: number[] = [];
	for (let L = start; L <= PROFILE_TITLE_MAX_LEVEL && out.length < count; L++) {
		out.push(L);
	}
	return out;
}
