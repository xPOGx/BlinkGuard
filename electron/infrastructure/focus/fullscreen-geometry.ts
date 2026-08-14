import {
	sanitizePauseAppCandidates,
	type PauseAppRule,
} from "../../../shared/preferences";
import type { FocusForegroundSnapshot } from "../../application/ports/focus-environment-port";

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
 * Extra trailing fields (process/title) are ignored.
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

function identityTokens(
	processName: string | undefined,
	windowTitle: string | undefined,
): { processName: string | null; windowTitle: string | null } {
	return {
		processName: processName?.trim() || null,
		windowTitle: windowTitle?.trim() || null,
	};
}

/**
 * Parse trailing process/title from a probe line:
 * `0|||proc|title`, `F|||proc|title`, or `1|id|l|t|r|b|proc|title`.
 */
export function parseForegroundIdentity(line: string): {
	processName: string | null;
	windowTitle: string | null;
} {
	if (!line) return { processName: null, windowTitle: null };
	const parts = line.split("|");
	const kind = parts[0];
	if (kind === "1") {
		if (parts.length < 8) return { processName: null, windowTitle: null };
		return identityTokens(parts[6], parts[7]);
	}
	if (kind === "0" || kind === "F") {
		if (parts.length < 5) return { processName: null, windowTitle: null };
		return identityTokens(parts[3], parts[4]);
	}
	return { processName: null, windowTitle: null };
}

/**
 * Probe line → snapshot. `F…` is macOS Space fullscreen; otherwise cover-ratio.
 */
export function interpretForegroundSnapshot(
	line: string,
	displayBounds: (bounds: RectBounds) => RectBounds,
): FocusForegroundSnapshot {
	const identity = parseForegroundIdentity(line);
	let isFullscreen = line.startsWith("F");
	if (!isFullscreen) {
		const bounds = parseProbeBounds(line);
		if (bounds) {
			isFullscreen = isNearFullscreenCover(bounds, displayBounds(bounds));
		}
	}
	return {
		isFullscreen,
		processName: identity.processName,
		windowTitle: identity.windowTitle,
	};
}

/**
 * Parse a running-app list line `L[{...}]` from the Win/mac host.
 * Host JSON uses `{p,t}` keys; extra/invalid rows are dropped.
 */
export function parseRunningAppListLine(line: string): PauseAppRule[] {
	if (!line.startsWith("L")) return [];
	try {
		const raw: unknown = JSON.parse(line.slice(1));
		const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
		return sanitizePauseAppCandidates(arr);
	} catch {
		return [];
	}
}
