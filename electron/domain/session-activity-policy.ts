import type {
	SessionIdleCause,
	SessionPauseMode,
} from "../../shared/session-pause-status";

export const SESSION_RESUME_DELAY_MS = 1800;

export type { SessionIdleCause, SessionPauseMode };

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

/** Primary UI cause: suspend > lock > display-off > lid. */
export function resolveSessionIdleCause(
	input: SessionActivityFlags,
): SessionIdleCause | null {
	if (input.suspended) return "suspend";
	if (input.locked) return "lock";
	if (input.displaysAsleep) return "display-off";
	if (input.lidClosed) return "lid";
	return null;
}

export function sessionPauseRank(mode: SessionPauseMode): number {
	return MODE_RANK[mode];
}
