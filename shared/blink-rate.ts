import { t, type Locale } from "./i18n";

/** Rolling window used for live blinks-per-minute. */
export const BLINK_RATE_WINDOW_MS = 60_000;

/**
 * Minimum fraction of the rolling window that must have a visible face before
 * live BPM is considered ready (camera face-aware mode).
 */
export const BLINK_RATE_MIN_FACE_COVERAGE = 0.4;

/** Below typical screen-work floor (guidance: ~4–7/min during focus). */
export const BLINK_RATE_LOW_MAX = 4;

/** Inclusive upper bound of OK band; Good starts at resting guidance (~15–20/min). */
export const BLINK_RATE_OK_MAX = 14;

export type BlinkRateQuality = "low" | "ok" | "good";

export type BlinkRateGuidance = {
	quality: BlinkRateQuality;
	label: string;
	description: string;
};

/** Closed [start, end] interval of face-visible time (ms epoch). */
export type FaceVisibleSegment = {
	startMs: number;
	endMs: number;
};

export type ComputeBlinksPerMinuteOptions = {
	windowMs?: number;
	/** When set and > 0, BPM = blinks / (faceVisibleMs / 60000). */
	faceVisibleMs?: number;
};

/**
 * Face-visible ms required before BPM is ready
 * (`BLINK_RATE_MIN_FACE_COVERAGE * window`).
 */
export function blinkRateCoverageReadyMs(
	windowMs: number = BLINK_RATE_WINDOW_MS,
	minCoverage: number = BLINK_RATE_MIN_FACE_COVERAGE,
): number {
	return windowMs * minCoverage;
}

/** True when enough face-visible time exists in the rolling window. */
export function isBlinkRateCoverageReady(
	faceVisibleMs: number,
	windowMs: number = BLINK_RATE_WINDOW_MS,
	minCoverage: number = BLINK_RATE_MIN_FACE_COVERAGE,
): boolean {
	if (!Number.isFinite(faceVisibleMs) || faceVisibleMs <= 0) return false;
	return faceVisibleMs >= blinkRateCoverageReadyMs(windowMs, minCoverage);
}

/**
 * Sum face-visible duration inside `[nowMs - windowMs, nowMs]`.
 * Optional open segment (`openSinceMs`) counts through `nowMs`.
 */
export function computeFaceVisibleMsInWindow(
	segments: FaceVisibleSegment[],
	nowMs: number,
	windowMs: number = BLINK_RATE_WINDOW_MS,
	openSinceMs: number | null = null,
): number {
	const cutoff = nowMs - windowMs;
	let total = 0;
	for (const segment of segments) {
		const start = Math.max(segment.startMs, cutoff);
		const end = Math.min(segment.endMs, nowMs);
		if (end > start) total += end - start;
	}
	if (openSinceMs !== null && Number.isFinite(openSinceMs)) {
		const start = Math.max(openSinceMs, cutoff);
		if (nowMs > start) total += nowMs - start;
	}
	return total;
}

/** Drop segments that end before the rolling-window cutoff. */
export function pruneFaceVisibleSegments(
	segments: FaceVisibleSegment[],
	nowMs: number,
	windowMs: number = BLINK_RATE_WINDOW_MS,
): FaceVisibleSegment[] {
	const cutoff = nowMs - windowMs;
	return segments.filter((segment) => segment.endMs > cutoff);
}

/**
 * Count credited blink timestamps inside the rolling window and scale to /min.
 * Partial windows still use a full minute denominator so early samples stay
 * conservative — unless `faceVisibleMs` is provided (camera coverage mode).
 */
export function pruneBlinkTimestamps(
	timestamps: number[],
	nowMs: number,
	windowMs: number = BLINK_RATE_WINDOW_MS,
): number[] {
	const cutoff = nowMs - windowMs;
	return timestamps.filter((ts) => ts > cutoff && ts <= nowMs);
}

export function computeBlinksPerMinute(
	timestamps: number[],
	nowMs: number,
	windowMsOrOptions: number | ComputeBlinksPerMinuteOptions = BLINK_RATE_WINDOW_MS,
): number {
	const options: ComputeBlinksPerMinuteOptions =
		typeof windowMsOrOptions === "number"
			? { windowMs: windowMsOrOptions }
			: windowMsOrOptions;
	const windowMs = options.windowMs ?? BLINK_RATE_WINDOW_MS;
	const recent = pruneBlinkTimestamps(timestamps, nowMs, windowMs);
	if (recent.length === 0) return 0;
	const faceVisibleMs = options.faceVisibleMs;
	if (
		faceVisibleMs !== undefined &&
		Number.isFinite(faceVisibleMs) &&
		faceVisibleMs > 0
	) {
		return (recent.length * 60_000) / faceVisibleMs;
	}
	return (recent.length * 60_000) / windowMs;
}

export function classifyBlinkRate(
	bpm: number,
	locale: Locale = "en",
): BlinkRateGuidance {
	if (bpm < BLINK_RATE_LOW_MAX) {
		return {
			quality: "low",
			label: t(locale, "rate.low"),
			description: t(locale, "rate.lowDesc"),
		};
	}
	if (bpm <= BLINK_RATE_OK_MAX) {
		return {
			quality: "ok",
			label: t(locale, "rate.ok"),
			description: t(locale, "rate.okDesc"),
		};
	}
	return {
		quality: "good",
		label: t(locale, "rate.good"),
		description: t(locale, "rate.goodDesc"),
	};
}

export function formatBlinksPerMinute(bpm: number): string {
	if (!Number.isFinite(bpm) || bpm <= 0) return "0";
	const rounded = Math.round(bpm * 10) / 10;
	return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
