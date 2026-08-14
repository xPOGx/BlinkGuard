import type { SessionActivitySnapshot } from "../../application/ports/session-activity-port";

/**
 * Host stdout: `d0` display off, `d1`/`d2` on/dimmed, `l1` lid closed, `l0` open.
 */
export function parseSessionActivityLine(
	line: string,
	prev: SessionActivitySnapshot,
): SessionActivitySnapshot | null {
	const token = line.trim();
	if (token === "d0") return { ...prev, displaysAsleep: true };
	if (token === "d1" || token === "d2") {
		return { ...prev, displaysAsleep: false };
	}
	if (token === "l1") return { ...prev, lidClosed: true };
	if (token === "l0") return { ...prev, lidClosed: false };
	return null;
}
