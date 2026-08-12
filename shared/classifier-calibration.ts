/** Stage 5 personal classifier overlay (bias + optional threshold). */

export const PERSONAL_BIAS_MIN = -2;
export const PERSONAL_BIAS_MAX = 2;
export const PERSONAL_THRESHOLD_MIN = 0.15;
export const PERSONAL_THRESHOLD_MAX = 0.3;

/** Baked logistic veto from classifier_weights.json. */
export const CLASSIFIER_BAKED_THRESHOLD = 0.25;

/** Median blink p after bias should sit near this. */
export const CLASSIFIER_TARGET_P = 0.7;

/** Same band as Python CLASSIFIER_SIDE_YAW_WAIVE — Phase B is frontal. */
export const CLASSIFIER_SIDE_YAW_WAIVE = 0.35;

export const CLASSIFIER_CALIBRATION_MIN_BLINKS = 6;
export const CLASSIFIER_CALIBRATION_BLINK_DURATION_MS = 20_000;

const LOGIT_EPS = 1e-6;
const THRESHOLD_MARGIN = 0.08;

export type CalibrationPhase = "open_eye" | "blinks";

export type ClassifierCalibrationPayload = {
	bias: number | null;
	threshold: number | null;
};

export type CalibrationProgressPayload = {
	elapsedMs: number;
	sampleCount: number;
	durationMs: number;
	faceDetected: boolean;
	phase: CalibrationPhase;
	blinkCount: number;
};

export type CalibrationCompletePayload = {
	baseline: number | null;
	classifierBias?: number | null;
	classifierThreshold?: number | null;
	error?: string;
};

export function isValidClassifierBias(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= PERSONAL_BIAS_MIN &&
		value <= PERSONAL_BIAS_MAX
	);
}

export function isValidClassifierThreshold(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= PERSONAL_THRESHOLD_MIN &&
		value <= PERSONAL_THRESHOLD_MAX
	);
}

export function sanitizeClassifierBias(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const n = typeof value === "number" ? value : Number(value);
	return isValidClassifierBias(n) ? n : null;
}

export function sanitizeClassifierThreshold(value: unknown): number | null {
	if (value === null || value === undefined || value === "") return null;
	const n = typeof value === "number" ? value : Number(value);
	return isValidClassifierThreshold(n) ? n : null;
}

export function sanitizeClassifierCalibrationPayload(
	input: unknown,
): ClassifierCalibrationPayload | null {
	if (input === null) return { bias: null, threshold: null };
	if (!input || typeof input !== "object") return null;
	const record = input as Record<string, unknown>;
	return {
		bias: sanitizeClassifierBias(record.bias),
		threshold: sanitizeClassifierThreshold(record.threshold),
	};
}

export function logit(p: number): number {
	const x = Math.min(1 - LOGIT_EPS, Math.max(LOGIT_EPS, p));
	return Math.log(x / (1 - x));
}

export function sigmoid(z: number): number {
	if (z >= 40) return 1;
	if (z <= -40) return 0;
	return 1 / (1 + Math.exp(-z));
}

function finiteOpenUnit(ps: number[]): number[] {
	return ps.filter(
		(p) => typeof p === "number" && Number.isFinite(p) && p > 0 && p < 1,
	);
}

function medianSorted(sorted: number[]): number {
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? (sorted[mid - 1] + sorted[mid]) / 2
		: sorted[mid];
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/** b = logit(0.70) − median(logit(p_i)), clamped to ±2. */
export function personalBiasFromScores(ps: number[]): number | null {
	const filtered = finiteOpenUnit(ps);
	if (filtered.length < CLASSIFIER_CALIBRATION_MIN_BLINKS) return null;
	const logits = filtered.map(logit).sort((a, b) => a - b);
	const bias = logit(CLASSIFIER_TARGET_P) - medianSorted(logits);
	return clamp(bias, PERSONAL_BIAS_MIN, PERSONAL_BIAS_MAX);
}

export function applyBiasToScore(p: number, bias: number): number {
	return sigmoid(logit(p) + bias);
}

/**
 * Keep baked t=0.25 unless the weakest biased p is within 0.08 of it.
 * Then t = clamp(min_p − 0.08, 0.15, 0.30).
 */
export function personalThresholdFromScores(
	ps: number[],
	bias: number,
	baked = CLASSIFIER_BAKED_THRESHOLD,
): number {
	const biased = finiteOpenUnit(ps).map((p) => applyBiasToScore(p, bias));
	if (biased.length === 0) return baked;
	const minP = Math.min(...biased);
	if (minP - THRESHOLD_MARGIN >= baked) return baked;
	return clamp(minP - THRESHOLD_MARGIN, PERSONAL_THRESHOLD_MIN, PERSONAL_THRESHOLD_MAX);
}
