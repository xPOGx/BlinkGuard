/** Minimum fraction of display area a window must cover to count as fullscreen. */
export const FULLSCREEN_COVER_RATIO = 0.95;

/** Max total margin (both sides) as a fraction of display size. */
export const FULLSCREEN_MARGIN_RATIO = 0.05;

export interface RectBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * True when `bounds` nearly fills `display` (cover ratio + small margins).
 * Shared by Windows and macOS fullscreen detectors.
 */
export function isNearFullscreenCover(
	bounds: RectBounds,
	display: RectBounds,
): boolean {
	if (bounds.width <= 0 || bounds.height <= 0) return false;
	if (display.width <= 0 || display.height <= 0) return false;

	const cover =
		(bounds.width * bounds.height) / (display.width * display.height);
	if (cover < FULLSCREEN_COVER_RATIO) return false;

	const marginX =
		Math.abs(bounds.x - display.x) +
		Math.abs(bounds.x + bounds.width - (display.x + display.width));
	const marginY =
		Math.abs(bounds.y - display.y) +
		Math.abs(bounds.y + bounds.height - (display.y + display.height));
	return (
		marginX <= display.width * FULLSCREEN_MARGIN_RATIO &&
		marginY <= display.height * FULLSCREEN_MARGIN_RATIO
	);
}

/**
 * Parse a probe line `1|id|left|top|right|bottom` into bounds, or null.
 */
export function parseProbeBounds(line: string): RectBounds | null {
	if (!line || line === "0") return null;
	const parts = line.split("|");
	if (parts[0] !== "1" || parts.length < 6) return null;
	const left = Number(parts[2]);
	const top = Number(parts[3]);
	const right = Number(parts[4]);
	const bottom = Number(parts[5]);
	if (![left, top, right, bottom].every(Number.isFinite)) return null;
	const width = Math.max(0, right - left);
	const height = Math.max(0, bottom - top);
	if (width === 0 || height === 0) return null;
	return { x: left, y: top, width, height };
}
