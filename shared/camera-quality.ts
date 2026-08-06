import type { CameraQuality } from "./preferences";

export type PoseStrictness = "loose" | "normal" | "strict";

export interface CameraQualityPreset {
	targetFps: number;
	processingResolution: [number, number];
	faceDetectInterval: number;
	poseStrictness: PoseStrictness;
}

/** Preset → sidecar NDJSON config. Keep UI and Electron sidecar in sync via this map. */
export const CAMERA_QUALITY_PRESETS: Readonly<
	Record<CameraQuality, CameraQualityPreset>
> = {
	performance: {
		targetFps: 10,
		processingResolution: [320, 240],
		faceDetectInterval: 2,
		poseStrictness: "loose",
	},
	medium: {
		targetFps: 15,
		processingResolution: [480, 360],
		faceDetectInterval: 1,
		poseStrictness: "normal",
	},
	// High = more pixels/FPS for landmarks — not harsher pose gates
	// (strict yaw/pitch was killing side-monitor + screen-bottom blinks).
	high: {
		targetFps: 20,
		processingResolution: [640, 480],
		faceDetectInterval: 1,
		poseStrictness: "normal",
	},
};

export const CAMERA_QUALITY_OPTIONS = [
	"performance",
	"medium",
	"high",
] as const satisfies readonly CameraQuality[];

export function isCameraQuality(value: unknown): value is CameraQuality {
	return (
		value === "performance" || value === "medium" || value === "high"
	);
}

/** Wire format for blink-detector stdin (multi-key message). */
export function toSidecarCameraQualityMessage(quality: CameraQuality): {
	target_fps: number;
	processing_resolution: [number, number];
	face_detect_interval: number;
	pose_strictness: PoseStrictness;
} {
	const preset = CAMERA_QUALITY_PRESETS[quality];
	return {
		target_fps: preset.targetFps,
		processing_resolution: preset.processingResolution,
		face_detect_interval: preset.faceDetectInterval,
		pose_strictness: preset.poseStrictness,
	};
}
