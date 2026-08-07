import { describe, expect, it } from "vitest";
import {
	CAMERA_QUALITY_PRESETS,
	isCameraQuality,
	toSidecarCameraQualityMessage,
} from "../../../shared/camera-quality";
import {
	isValidEarCalibration,
	medianEarCalibration,
} from "../../../shared/ear-calibration";
import {
	type AppPreferences,
	DEFAULT_EXERCISE_PROMPTS,
	DEFAULT_PREFERENCES,
	sanitizeExercisePrompts,
	toRendererPreferences,
} from "../../../shared/preferences";

describe("toRendererPreferences", () => {
	it("converts reminderInterval from ms to seconds for the settings UI", () => {
		const preferences: AppPreferences = {
			...DEFAULT_PREFERENCES,
			reminderInterval: 4500,
			isTracking: true,
		};

		const renderer = toRendererPreferences(preferences);

		expect(renderer.reminderInterval).toBe(4.5);
		expect(renderer.isTracking).toBe(true);
		expect(renderer.popupMessage).toBe(DEFAULT_PREFERENCES.popupMessage);
		expect(renderer.cameraQuality).toBe("medium");
		expect(renderer.earCalibration).toBeNull();
	});
});

describe("camera quality presets", () => {
	it("maps performance / medium / high to the quality table", () => {
		expect(CAMERA_QUALITY_PRESETS.performance).toEqual({
			targetFps: 10,
			processingResolution: [320, 240],
			faceDetectInterval: 2,
			poseStrictness: "loose",
		});
		expect(CAMERA_QUALITY_PRESETS.medium).toEqual({
			targetFps: 15,
			processingResolution: [480, 360],
			faceDetectInterval: 1,
			poseStrictness: "normal",
		});
		expect(CAMERA_QUALITY_PRESETS.high).toEqual({
			targetFps: 20,
			processingResolution: [640, 480],
			faceDetectInterval: 1,
			poseStrictness: "normal",
		});
	});

	it("defaults cameraQuality to medium in DEFAULT_PREFERENCES", () => {
		expect(DEFAULT_PREFERENCES.cameraQuality).toBe("medium");
	});

	it("serializes presets to sidecar NDJSON field names", () => {
		expect(toSidecarCameraQualityMessage("high")).toEqual({
			target_fps: 20,
			processing_resolution: [640, 480],
			face_detect_interval: 1,
			pose_strictness: "normal",
		});
	});

	it("validates camera quality values", () => {
		expect(isCameraQuality("medium")).toBe(true);
		expect(isCameraQuality("ultra")).toBe(false);
		expect(isCameraQuality("max")).toBe(false);
	});
});

describe("ear calibration helpers", () => {
	it("validates plausible open-eye EAR values", () => {
		expect(isValidEarCalibration(0.28)).toBe(true);
		expect(isValidEarCalibration(null)).toBe(false);
		expect(isValidEarCalibration(0.05)).toBe(false);
		expect(isValidEarCalibration(0.9)).toBe(false);
	});

	it("computes median from enough samples", () => {
		const samples = Array.from({ length: 15 }, () => 0.27);
		samples[7] = 0.29;
		expect(medianEarCalibration(samples)).toBeCloseTo(0.27, 5);
	});

	it("returns null when too few samples", () => {
		expect(medianEarCalibration([0.28, 0.29])).toBeNull();
	});
});

describe("phase 4 preference defaults", () => {
	it("defaults earCalibration to null", () => {
		expect(DEFAULT_PREFERENCES.earCalibration).toBeNull();
	});
});

describe("tray / autostart preference defaults", () => {
	it("defaults launchAtLogin and isTracking to false", () => {
		expect(DEFAULT_PREFERENCES.launchAtLogin).toBe(false);
		expect(DEFAULT_PREFERENCES.isTracking).toBe(false);
	});
});

describe("look-away / 20-20-20 preference defaults", () => {
	it("defaults to classic 20-20-20 values and enabled", () => {
		expect(DEFAULT_PREFERENCES.lookAwayEnabled).toBe(true);
		expect(DEFAULT_PREFERENCES.lookAwayInterval).toBe(20);
		expect(DEFAULT_PREFERENCES.lookAwayDuration).toBe(20);
	});
});

describe("quiet hours / focus preference defaults", () => {
	it("defaults quiet hours overnight and fullscreen pause on", () => {
		expect(DEFAULT_PREFERENCES.quietHoursEnabled).toBe(true);
		expect(DEFAULT_PREFERENCES.quietHoursStart).toBe("22:00");
		expect(DEFAULT_PREFERENCES.quietHoursEnd).toBe("08:00");
		expect(DEFAULT_PREFERENCES.pauseOnFullscreen).toBe(true);
	});
});

describe("onboarding preference defaults", () => {
	it("defaults hasCompletedOnboarding to false for first-run", () => {
		expect(DEFAULT_PREFERENCES.hasCompletedOnboarding).toBe(false);
	});
});

describe("sanitizeExercisePrompts", () => {
	it("defaults to the built-in four prompts", () => {
		expect(DEFAULT_PREFERENCES.exercisePrompts).toEqual([
			...DEFAULT_EXERCISE_PROMPTS,
		]);
		expect(DEFAULT_PREFERENCES.exercisePrompts).toHaveLength(4);
	});

	it("returns defaults for non-arrays, empty arrays, and whitespace-only", () => {
		expect(sanitizeExercisePrompts(null)).toEqual([
			...DEFAULT_EXERCISE_PROMPTS,
		]);
		expect(sanitizeExercisePrompts([])).toEqual([...DEFAULT_EXERCISE_PROMPTS]);
		expect(sanitizeExercisePrompts(["  ", ""])).toEqual([
			...DEFAULT_EXERCISE_PROMPTS,
		]);
	});

	it("trims and keeps valid lines", () => {
		expect(
			sanitizeExercisePrompts(["  Blink slowly  ", "", 42, "Look far"]),
		).toEqual(["Blink slowly", "Look far"]);
	});
});
