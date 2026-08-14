export const SESSION_RESUME_DELAY_MS = 1800;

export type SessionPauseMode = "active" | "camera-only" | "inactive";

export type SessionActivityFlags = {
	suspended: boolean;
	locked: boolean;
	displaysAsleep: boolean;
	lidClosed: boolean;
};

const MODE_RANK: Record<SessionPauseMode, number> = {
	active: 0,
	"camera-only": 1,
	inactive: 2,
};

/**
 * Suspend, lock, or all displays asleep → full session pause.
 * Lid closed with displays still on (clamshell) → camera-only pause.
 */
export function resolveSessionPauseMode(
	input: SessionActivityFlags,
): SessionPauseMode {
	if (input.suspended || input.locked || input.displaysAsleep) {
		return "inactive";
	}
	if (input.lidClosed) return "camera-only";
	return "active";
}

export function sessionPauseRank(mode: SessionPauseMode): number {
	return MODE_RANK[mode];
}
