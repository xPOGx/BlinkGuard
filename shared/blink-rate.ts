import { t, type Locale } from "./i18n";

/** Rolling window used for live blinks-per-minute. */
export const BLINK_RATE_WINDOW_MS = 60_000;

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

/**
 * Count credited blink timestamps inside the rolling window and scale to /min.
 * Partial windows still use a full minute denominator so early samples stay conservative.
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
	windowMs: number = BLINK_RATE_WINDOW_MS,
): number {
	const recent = pruneBlinkTimestamps(timestamps, nowMs, windowMs);
	if (recent.length === 0) return 0;
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
