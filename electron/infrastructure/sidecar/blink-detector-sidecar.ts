import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import {
	EAR_CALIBRATION_DURATION_MS,
	isValidEarCalibration,
	medianEarCalibration,
} from "../../../shared/ear-calibration";
import {
	isCameraQuality,
	toSidecarCameraQualityMessage,
} from "../../../shared/camera-quality";
import type {
	AppPreferences,
	CameraQuality,
} from "../../../shared/preferences";
import type { BlinkDetectorDebugLogger } from "../logging/blink-detector-debug-logger";
import type { AppPaths } from "../paths/app-paths";
import type { ChildProcessRegistry } from "../process/child-process-registry";
import { NdjsonBuffer, SIDECAR_STATUS, encodeSidecarMessage } from "./protocol";

interface SidecarCallbacks {
	onBlink: (data: { ear?: number; time?: number }) => void;
	onFaceData: (data: unknown) => void;
	onVideoStream: (data: unknown) => void;
	onError: (message: string) => void;
	onCameraReady: () => void;
	shouldRetryCamera: () => boolean;
	/** True while the camera preview BrowserWindow is open. */
	isCameraWindowOpen?: () => boolean;
	onCalibrationProgress?: (payload: {
		elapsedMs: number;
		sampleCount: number;
		durationMs: number;
		faceDetected: boolean;
	}) => void;
	onCalibrationComplete?: (payload: {
		baseline: number | null;
		error?: string;
	}) => void;
}

interface FaceDataSample {
	faceDetected?: boolean;
	ear?: number;
	blink?: boolean;
	blink_phase?: string;
}

export class BlinkDetectorSidecar {
	private process: ChildProcessWithoutNullStreams | null = null;
	private running = false;
	private cameraReady = false;
	private retryCount = 0;
	private readonly maxRetries = 20;
	private calibrationSamples: number[] = [];
	private calibrationActive = false;
	private calibrationStartedAt = 0;
	private calibrationDurationMs = EAR_CALIBRATION_DURATION_MS;
	private calibrationTimer: ReturnType<typeof setTimeout> | null = null;
	private calibrationProgressTimer: ReturnType<typeof setInterval> | null =
		null;
	private calibrationFaceDetected = false;
	/** Coalesce stop/start so quality+restart land in one Python command batch. */
	private cameraFlushTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingCameraStop = false;
	private pendingCameraStart = false;

	constructor(
		private readonly paths: AppPaths,
		private readonly isProd: boolean,
		private readonly processes: ChildProcessRegistry,
		private readonly preferences: AppPreferences,
		private readonly callbacks: SidecarCallbacks,
		private readonly debugLogger?: BlinkDetectorDebugLogger,
	) {}

	get isRunning(): boolean {
		return this.running;
	}

	get isCameraReady(): boolean {
		return this.cameraReady;
	}

	get isCalibrating(): boolean {
		return this.calibrationActive;
	}

	start(): void {
		if (this.running) return;
		if (this.process?.pid && !this.process.killed) {
			this.running = true;
			return;
		}
		const basePath = this.isProd
			? path.join(
					process.resourcesPath,
					"app.asar.unpacked",
					"electron",
					"resources",
					"blink_detector",
				)
			: path.join(
					this.paths.root,
					"electron",
					"resources",
					"blink_detector",
				);
		const executablePath =
			process.platform === "win32" ? `${basePath}.exe` : basePath;
		if (!existsSync(executablePath)) {
			console.error(
				"Blink detector binary not found. Please run the build script first: cd python && ./build_and_install.sh",
			);
			return;
		}

		this.running = true;
		const child = spawn(executablePath, [], {
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				// Softens OpenCV MSMF init on Win10/11 (Frame Server / old UVC).
				...(process.platform === "win32" &&
				process.env.OPENCV_VIDEOIO_MSMF_ENABLE_HW_TRANSFORMS === undefined
					? { OPENCV_VIDEOIO_MSMF_ENABLE_HW_TRANSFORMS: "0" }
					: {}),
			},
			...(process.platform === "win32" && {
				windowsHide: true,
				detached: false,
				shell: false,
			}),
		});
		this.process = child;
		this.processes.add(child);
		child.on("exit", (code) => {
			console.log(`Blink detector process exited with code: ${code}`);
			this.processes.delete(child);
			if (this.process === child) this.process = null;
			this.running = false;
			this.cameraReady = false;
			this.clearCameraFlush();
			this.cancelEarCalibration("Blink detector stopped");
		});
		child.on("error", (error) => {
			console.error("Blink detector process error:", error);
			this.callbacks.onError(`Process error: ${error.message}`);
			this.processes.delete(child);
			if (this.process === child) this.process = null;
			this.running = false;
			this.cameraReady = false;
			this.clearCameraFlush();
			this.cancelEarCalibration("Blink detector error");
		});
		this.readStdout(child);
		// OpenCV/MSMF often prints [WARN] to stderr while capture still works —
		// never promote raw stderr to the settings error banner (NDJSON `error` is enough).
		child.stderr.on("data", (data: Buffer) => {
			console.error("Blink detector stderr:", data.toString());
		});
	}

	startCamera(): boolean {
		if (!this.running || !this.process?.stdin) {
			console.error("Blink detector not running");
			return false;
		}
		// Already live — refresh config + video without stop/start thrash.
		if (this.cameraReady && !this.pendingCameraStop) {
			this.applySessionConfig();
			this.requestVideo();
			return true;
		}
		this.pendingCameraStart = true;
		this.scheduleCameraFlush();
		return true;
	}

	stopCamera(): void {
		if (!this.running || !this.process?.stdin) {
			this.cameraReady = false;
			return;
		}
		this.pendingCameraStart = false;
		this.pendingCameraStop = true;
		this.cameraReady = false;
		this.scheduleCameraFlush();
	}

	requestVideo(): void {
		this.write({ request_video: true });
	}

	/** Push the given (or current) quality preset to a live sidecar. */
	applyCameraQuality(quality?: CameraQuality): void {
		const resolved = quality ?? this.preferences.cameraQuality;
		if (!isCameraQuality(resolved)) return;
		this.write(toSidecarCameraQualityMessage(resolved));
	}

	private clearCameraFlush(): void {
		if (this.cameraFlushTimer) {
			clearTimeout(this.cameraFlushTimer);
			this.cameraFlushTimer = null;
		}
		this.pendingCameraStop = false;
		this.pendingCameraStart = false;
	}

	private scheduleCameraFlush(): void {
		if (this.cameraFlushTimer) return;
		this.cameraFlushTimer = setTimeout(() => {
			this.cameraFlushTimer = null;
			this.flushCameraIntent();
		}, 75);
	}

	private flushCameraIntent(): void {
		const stop = this.pendingCameraStop;
		const start = this.pendingCameraStart;
		this.pendingCameraStop = false;
		this.pendingCameraStart = false;
		if (!this.running || !this.process?.stdin) return;
		if (stop) {
			this.write({ stop_camera: true });
		}
		if (start) {
			// Quality/EAR before start so CAP_PROP uses the preset, not 320×240.
			this.applySessionConfig();
			this.write({ start_camera: true });
			// stop_camera clears Python send_video; restore preview if window open.
			this.requestVideoIfPreviewOpen();
		}
	}

	/** Re-enable JPEG preview after stop→start without forcing encode when closed. */
	private requestVideoIfPreviewOpen(): void {
		if (this.callbacks.isCameraWindowOpen?.()) {
			this.requestVideo();
		}
	}

	/** Push personal open-eye EAR baseline (or clear with null). */
	applyEarCalibration(baseline?: number | null): void {
		const resolved =
			baseline === undefined
				? this.preferences.earCalibration
				: baseline;
		if (resolved === null) {
			this.write({ ear_calibration: null });
			return;
		}
		if (!isValidEarCalibration(resolved)) return;
		this.write({ ear_calibration: resolved });
	}

	/** Apply quality + calibration after models are ready. */
	applySessionConfig(): void {
		this.applyCameraQuality();
		this.applyEarCalibration();
	}

	startEarCalibration(durationMs = EAR_CALIBRATION_DURATION_MS): boolean {
		if (this.calibrationActive) return false;
		if (!this.running) {
			this.callbacks.onCalibrationComplete?.({
				baseline: null,
				error: "Blink detector is not running",
			});
			return false;
		}

		this.calibrationActive = true;
		this.calibrationSamples = [];
		this.calibrationFaceDetected = false;
		this.calibrationStartedAt = Date.now();
		this.calibrationDurationMs = durationMs;

		this.calibrationProgressTimer = setInterval(() => {
			if (!this.calibrationActive) return;
			this.callbacks.onCalibrationProgress?.({
				elapsedMs: Date.now() - this.calibrationStartedAt,
				sampleCount: this.calibrationSamples.length,
				durationMs: this.calibrationDurationMs,
				faceDetected: this.calibrationFaceDetected,
			});
		}, 250);

		this.calibrationTimer = setTimeout(() => {
			this.finishEarCalibration();
		}, durationMs);

		this.callbacks.onCalibrationProgress?.({
			elapsedMs: 0,
			sampleCount: 0,
			durationMs,
			faceDetected: false,
		});
		return true;
	}

	cancelEarCalibration(reason?: string): void {
		if (!this.calibrationActive) return;
		this.clearCalibrationTimers();
		this.calibrationActive = false;
		this.calibrationSamples = [];
		this.callbacks.onCalibrationComplete?.({
			baseline: null,
			error: reason ?? "Calibration cancelled",
		});
	}

	markCameraUnavailable(): void {
		this.cameraReady = false;
	}

	private finishEarCalibration(): void {
		if (!this.calibrationActive) return;
		const samples = this.calibrationSamples;
		this.clearCalibrationTimers();
		this.calibrationActive = false;
		this.calibrationSamples = [];

		const baseline = medianEarCalibration(samples);
		if (baseline === null) {
			this.callbacks.onCalibrationComplete?.({
				baseline: null,
				error:
					"Not enough open-eye samples. Keep your face centered with eyes open.",
			});
			return;
		}
		this.callbacks.onCalibrationComplete?.({ baseline });
	}

	private clearCalibrationTimers(): void {
		if (this.calibrationTimer) {
			clearTimeout(this.calibrationTimer);
			this.calibrationTimer = null;
		}
		if (this.calibrationProgressTimer) {
			clearInterval(this.calibrationProgressTimer);
			this.calibrationProgressTimer = null;
		}
	}

	private sampleFaceDataForCalibration(data: FaceDataSample): void {
		if (!this.calibrationActive) return;
		this.calibrationFaceDetected = Boolean(data.faceDetected);
		if (!data.faceDetected) return;
		if (data.blink) return;
		if (data.blink_phase === "start" || data.blink_phase === "complete") {
			return;
		}
		const ear = data.ear;
		if (typeof ear !== "number" || !Number.isFinite(ear)) return;
		this.calibrationSamples.push(ear);
	}

	private readStdout(child: ChildProcessWithoutNullStreams): void {
		const buffer = new NdjsonBuffer();
		child.stdout.on("data", (data: Buffer) => {
			for (const line of buffer.push(data)) {
				try {
					this.handleMessage(JSON.parse(line));
				} catch (error) {
					console.error("Failed to parse blink detector output:", error);
				}
			}
		});
	}

	private handleMessage(message: Record<string, any>): void {
		this.debugLogger?.captureSidecarMessage(message);
		if (message.blink) {
			this.callbacks.onBlink(message);
			return;
		}
		if (message.error) {
			this.handleCameraError(String(message.error));
			return;
		}
		if (message.status) {
			if (message.status === SIDECAR_STATUS.modelsReady) {
				this.applySessionConfig();
			} else if (
				message.status === SIDECAR_STATUS.cameraReady ||
				message.status === SIDECAR_STATUS.cameraStarted
			) {
				this.cameraReady = true;
				this.retryCount = 0;
				// Cover races where stop cleared send_video after an earlier request_video.
				this.requestVideoIfPreviewOpen();
				this.callbacks.onCameraReady();
			}
			return;
		}
		if (message.faceData) {
			this.sampleFaceDataForCalibration(message.faceData as FaceDataSample);
			this.callbacks.onFaceData(message.faceData);
			return;
		}
		if (message.videoStream) {
			this.callbacks.onVideoStream(message.videoStream);
		}
	}

	private handleCameraError(message: string): void {
		console.error("Blink detector error:", message);
		this.callbacks.onError(message);
		const lower = message.toLowerCase();
		this.cameraReady = false;
		const isCameraError = ["camera", "permission", "access"].some((term) =>
			lower.includes(term),
		);
		if (!isCameraError || !this.callbacks.shouldRetryCamera()) return;
		this.retryCount++;
		if (this.retryCount > this.maxRetries) {
			this.callbacks.onError(
				"Camera access failed after multiple attempts. Please check camera permissions and restart tracking.",
			);
			this.retryCount = 0;
			return;
		}
		setTimeout(() => {
			if (this.callbacks.shouldRetryCamera() && this.running) {
				this.startCamera();
			}
		}, 3000);
	}

	private write(message: object): void {
		if (this.process?.stdin) {
			this.process.stdin.write(encodeSidecarMessage(message));
		}
	}
}
