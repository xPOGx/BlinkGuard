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
	DEFAULT_PREFERENCES,
	type AppPreferences,
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
		expect(renderer.useMediaPipe).toBe(false);
	});
});

describe("camera quality presets", () => {
	it("maps performance / medium / high to the Phase 3 table", () => {
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
	it("defaults earCalibration null and useMediaPipe false", () => {
		expect(DEFAULT_PREFERENCES.earCalibration).toBeNull();
		expect(DEFAULT_PREFERENCES.useMediaPipe).toBe(false);
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
