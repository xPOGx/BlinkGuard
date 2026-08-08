export const DEBUG_OVERLAY_KINDS = [
	"blink",
	"starting",
	"stopped",
	"lookAway",
	"exercise",
	"coach",
	"noFace",
] as const;

export type DebugOverlayKind = (typeof DEBUG_OVERLAY_KINDS)[number];

export function isDebugOverlayKind(
	value: unknown,
): value is DebugOverlayKind {
	return (
		typeof value === "string" &&
		(DEBUG_OVERLAY_KINDS as readonly string[]).includes(value)
	);
}
