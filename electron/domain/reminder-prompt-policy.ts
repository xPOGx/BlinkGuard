import { t } from "../../shared/i18n/t";
import type { Locale } from "../../shared/i18n/types";

/** Intensity ladder step for a blink miss / micro-break cue. */
export type BlinkPromptStep = "ambient" | "overlay" | "escalate" | "full";

/** Reminder interruptiveness profile (prefs `blinkPromptProfile`). */
export type BlinkPromptProfile = "standard" | "gentle" | "strong";

/** Absolute cap for ICMU-style healthy-BPM prompt spacing (ms). */
export const BLINK_BACKOFF_IMAX_MS = 60_000;
/**
 * Soft cap relative to miss gap `I0`. Without this, `I0=1s` + `Imax=60s`
 * lets one healthy show jump spacing to nearly a minute (slider feels stuck
 * after shrinking the interval). ICMU paper used ~4s `I0`; we scale.
 */
export const BLINK_BACKOFF_IMAX_I0_FACTOR = 10;

/** Effective Imax for a given `I0` (never below `I0`, never above absolute Imax). */
export function effectiveBackoffImaxMs(i0Ms: number): number {
	const i0 = Math.max(0, i0Ms);
	return Math.min(
		BLINK_BACKOFF_IMAX_MS,
		Math.max(i0 * BLINK_BACKOFF_IMAX_I0_FACTOR, i0),
	);
}

/** Camera face-aware overlay copy pool (i18n keys). */
export const BLINK_CAMERA_MESSAGE_POOL_KEYS = [
	"popup.blink.pool.0",
	"popup.blink.pool.1",
	"popup.blink.pool.2",
	"popup.blink.pool.3",
	"popup.blink.pool.4",
] as const;

/** Timer micro-break cue pool — no detection wording (i18n keys). */
export const BLINK_TIMER_MESSAGE_POOL_KEYS = [
	"popup.blink.timerPool.0",
	"popup.blink.timerPool.1",
	"popup.blink.timerPool.2",
	"popup.blink.timerPool.3",
	"popup.blink.timerPool.4",
] as const;

export type LowBpmCoachingInput = {
	cameraEnabled: boolean;
	isTracking: boolean;
	blinkRateCoachingEnabled: boolean;
	blinkRateReady: boolean;
	blinksPerMinute: number;
	thresholdPerMin: number;
};

/**
 * FR-6 gate: low ready BPM may skip Gentle ambient / escalate on first overlay.
 * Coaching toggle off or BPM not ready → inactive (treat rate as unknown).
 */
export function isLowBpmCoachingActive(input: LowBpmCoachingInput): boolean {
	if (!input.blinkRateCoachingEnabled) return false;
	if (!input.cameraEnabled || !input.isTracking) return false;
	if (!input.blinkRateReady) return false;
	if (
		!Number.isFinite(input.blinksPerMinute) ||
		!Number.isFinite(input.thresholdPerMin)
	) {
		return false;
	}
	return input.blinksPerMinute < input.thresholdPerMin;
}

export type NextBlinkPromptStepInput = LowBpmCoachingInput & {
	profile: BlinkPromptProfile;
	mgdMode: boolean;
	/** When true, FR-6 may return `"escalate"` on the first overlay. */
	soundEnabled: boolean;
	/** Blink overlay / native surface already visible for this miss session. */
	overlayShowing: boolean;
	/** Gentle ambient glow already visible. */
	ambientShowing: boolean;
	/** Escalate chime already played for this visible session. */
	escalateChimePlayed: boolean;
};

/**
 * Next ladder step for a due miss / micro-break tick.
 * Returns `null` when nothing further should change (e.g. already escalated).
 */
export function nextBlinkPromptStep(
	input: NextBlinkPromptStepInput,
): BlinkPromptStep | null {
	if (input.overlayShowing) {
		if (input.escalateChimePlayed) return null;
		return "escalate";
	}

	if (input.ambientShowing) {
		return "overlay";
	}

	// First visual of this miss session
	if (input.mgdMode) {
		// FR-4: never ambient. Strong may chime on first overlay.
		if (input.profile === "strong" && input.soundEnabled) {
			return "escalate";
		}
		return "overlay";
	}

	if (input.profile === "strong") {
		// Glow + overlay + sound in one step (sound gated in ReminderService).
		return "full";
	}

	const lowBpm = isLowBpmCoachingActive(input);

	if (input.profile === "standard") {
		// FR-6: Standard + low BPM + sound → escalate on first overlay
		if (lowBpm && input.soundEnabled) return "escalate";
		return "overlay";
	}

	// Gentle
	if (lowBpm) {
		if (input.soundEnabled) return "escalate";
		return "overlay";
	}
	return "ambient";
}

export type BlinkBackoffState = {
	readonly i0Ms: number;
	readonly intervalMs: number;
};

export type BackoffRng = {
	/** Uniform integer in `[0, maxExclusive)`. */
	randomInt(maxExclusive: number): number;
};

const defaultBackoffRng: BackoffRng = {
	randomInt(maxExclusive: number): number {
		if (maxExclusive <= 0) return 0;
		return Math.floor(Math.random() * maxExclusive);
	},
};

export type NextBackoffInput = {
	bpmReady: boolean;
	bpm: number;
	threshold: number;
	mgdMode: boolean;
	/** Timer mode (`cameraEnabled: false`) skips backoff. */
	cameraEnabled: boolean;
};

export function createBackoffState(i0Ms: number): BlinkBackoffState {
	const i0 = Math.max(0, i0Ms);
	return { i0Ms: i0, intervalMs: i0 };
}

export function resetBackoff(state: BlinkBackoffState): BlinkBackoffState {
	return { i0Ms: state.i0Ms, intervalMs: state.i0Ms };
}

/**
 * ICMU spacing update **after a prompt is shown**.
 * MGD and timer always stay at `I0`. Healthy ready BPM stretches
 * `I ← min(2I + J, ImaxEff)` with `J ~ U(0, ImaxEff − I0)` and
 * `ImaxEff = min(60s, max(10×I0, I0))` so a 1s miss gap cannot jump to a
 * full minute of silence after one healthy show.
 * Uses the threshold even when the coaching toggle is off (FR-6 only gates ladder).
 */
export function nextBackoffIntervalMs(
	state: BlinkBackoffState,
	input: NextBackoffInput,
	rng: BackoffRng = defaultBackoffRng,
): BlinkBackoffState {
	if (input.mgdMode || !input.cameraEnabled) {
		return resetBackoff(state);
	}

	const bpmOk =
		input.bpmReady &&
		Number.isFinite(input.bpm) &&
		Number.isFinite(input.threshold) &&
		input.bpm >= input.threshold;

	if (!bpmOk) {
		return resetBackoff(state);
	}

	const i0 = state.i0Ms;
	const current = state.intervalMs;
	const iMax = effectiveBackoffImaxMs(i0);
	const jSpan = Math.max(0, iMax - i0);
	const J = rng.randomInt(jSpan);
	const nextI = Math.min(2 * current + J, iMax);
	return { i0Ms: i0, intervalMs: nextI };
}

export type PickBlinkOverlayMessageInput = {
	locale: Locale;
	customPopupMessage: string;
	cameraEnabled: boolean;
	index: number;
	defaultPopupMessage: string;
};

/**
 * Custom non-default `popupMessage` wins; otherwise rotate camera vs timer i18n pool.
 */
export function pickBlinkOverlayMessage(
	input: PickBlinkOverlayMessageInput,
): string {
	const custom = input.customPopupMessage.trim();
	if (custom && custom !== input.defaultPopupMessage) {
		return input.customPopupMessage;
	}

	const pool = input.cameraEnabled
		? BLINK_CAMERA_MESSAGE_POOL_KEYS
		: BLINK_TIMER_MESSAGE_POOL_KEYS;
	const length = pool.length;
	const safeIndex = ((input.index % length) + length) % length;
	return t(input.locale, pool[safeIndex]);
}
