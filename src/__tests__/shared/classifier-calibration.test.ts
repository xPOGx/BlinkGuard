import { describe, expect, it } from "vitest";
import {
	applyBiasToScore,
	CLASSIFIER_BAKED_THRESHOLD,
	CLASSIFIER_CALIBRATION_MIN_BLINKS,
	CLASSIFIER_TARGET_P,
	logit,
	personalBiasFromScores,
	personalThresholdFromScores,
	sanitizeClassifierBias,
	sanitizeClassifierCalibrationPayload,
	sanitizeClassifierThreshold,
	sigmoid,
} from "../../../shared/classifier-calibration";

describe("logit / sigmoid", () => {
	it("round-trips mid-range probabilities", () => {
		expect(sigmoid(logit(0.7))).toBeCloseTo(0.7, 5);
		expect(sigmoid(0)).toBeCloseTo(0.5, 6);
	});
});

describe("personalBiasFromScores", () => {
	it("returns null below the blink floor", () => {
		expect(
			personalBiasFromScores(
				Array(CLASSIFIER_CALIBRATION_MIN_BLINKS - 1).fill(0.4),
			),
		).toBeNull();
	});

	it("shifts median p toward the 0.70 target", () => {
		const ps = Array(CLASSIFIER_CALIBRATION_MIN_BLINKS).fill(0.4);
		const bias = personalBiasFromScores(ps);
		expect(bias).not.toBeNull();
		const shifted = applyBiasToScore(0.4, bias as number);
		expect(shifted).toBeCloseTo(CLASSIFIER_TARGET_P, 5);
	});

	it("clamps extreme bias", () => {
		const ps = Array(CLASSIFIER_CALIBRATION_MIN_BLINKS).fill(0.01);
		const bias = personalBiasFromScores(ps);
		expect(bias).toBe(2);
	});
});

describe("personalThresholdFromScores", () => {
	it("keeps baked t when biased min p has headroom", () => {
		const ps = Array(CLASSIFIER_CALIBRATION_MIN_BLINKS).fill(0.4);
		const bias = personalBiasFromScores(ps) as number;
		expect(personalThresholdFromScores(ps, bias)).toBe(
			CLASSIFIER_BAKED_THRESHOLD,
		);
	});

	it("lowers t when the weakest biased p is close to baked", () => {
		const t = personalThresholdFromScores(
			[0.28, 0.3, 0.32, 0.35, 0.4, 0.45],
			0,
		);
		expect(t).toBeCloseTo(0.2, 5);
		expect(t).toBeGreaterThanOrEqual(0.15);
		expect(t).toBeLessThan(CLASSIFIER_BAKED_THRESHOLD);
	});
});

describe("sanitize classifier calibration", () => {
	it("accepts null and in-range numbers", () => {
		expect(sanitizeClassifierBias(null)).toBeNull();
		expect(sanitizeClassifierBias(0.4)).toBe(0.4);
		expect(sanitizeClassifierBias(9)).toBeNull();
		expect(sanitizeClassifierThreshold(0.2)).toBe(0.2);
		expect(sanitizeClassifierThreshold(0.5)).toBeNull();
	});

	it("parses a payload or null clear", () => {
		expect(sanitizeClassifierCalibrationPayload(null)).toEqual({
			bias: null,
			threshold: null,
		});
		expect(
			sanitizeClassifierCalibrationPayload({ bias: 0.5, threshold: 0.2 }),
		).toEqual({ bias: 0.5, threshold: 0.2 });
		expect(sanitizeClassifierCalibrationPayload("nope")).toBeNull();
	});
});
