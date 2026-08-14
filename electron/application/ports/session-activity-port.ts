export type SessionActivitySnapshot = {
	displaysAsleep: boolean;
	lidClosed: boolean;
};

export const EMPTY_SESSION_ACTIVITY: SessionActivitySnapshot = {
	displaysAsleep: false,
	lidClosed: false,
};

export function sameSessionActivitySnapshot(
	a: SessionActivitySnapshot,
	b: SessionActivitySnapshot,
): boolean {
	return a.displaysAsleep === b.displaysAsleep && a.lidClosed === b.lidClosed;
}

/** Push-based lid / display-sleep probe. Linux stub never emits. */
export interface SessionActivityPort {
	start(): void;
	dispose(): void;
}
