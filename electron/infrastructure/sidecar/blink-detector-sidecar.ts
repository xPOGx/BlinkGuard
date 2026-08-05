import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import type { AppPaths } from "../paths/app-paths";
import type { ChildProcessRegistry } from "../process/child-process-registry";
import { NdjsonBuffer, SIDECAR_STATUS, encodeSidecarMessage } from "./protocol";

interface SidecarCallbacks {
	onBlink: (data: { ear?: number; time?: number }) => void;
	onFaceData: (data: unknown) => void;
	onVideoStream: (data: unknown) => void;
	onError: (message: string) => void;
	shouldRetryCamera: () => boolean;
}

export class BlinkDetectorSidecar {
	private process: ChildProcessWithoutNullStreams | null = null;
	private running = false;
	private cameraReady = false;
	private retryCount = 0;
	private readonly maxRetries = 20;

	constructor(
		private readonly paths: AppPaths,
		private readonly isProd: boolean,
		private readonly processes: ChildProcessRegistry,
		private readonly callbacks: SidecarCallbacks,
	) {}

	get isRunning(): boolean {
		return this.running;
	}

	get isCameraReady(): boolean {
		return this.cameraReady;
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
		});
		child.on("error", (error) => {
			console.error("Blink detector process error:", error);
			this.callbacks.onError(`Process error: ${error.message}`);
			this.processes.delete(child);
			if (this.process === child) this.process = null;
			this.running = false;
			this.cameraReady = false;
		});
		this.readStdout(child);
		child.stderr.on("data", (data: Buffer) => {
			const message = data.toString();
			console.error("Blink detector stderr:", message);
			this.callbacks.onError(`Stderr: ${message}`);
		});
	}

	startCamera(): boolean {
		if (!this.running || !this.process?.stdin) {
			console.error("Blink detector not running");
			return false;
		}
		this.write({ start_camera: true });
		return true;
	}

	stopCamera(): void {
		if (this.running && this.process?.stdin) {
			this.write({ stop_camera: true });
		}
		this.cameraReady = false;
	}

	requestVideo(): void {
		this.write({ request_video: true });
	}

	markCameraUnavailable(): void {
		this.cameraReady = false;
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
		if (message.debug) console.log("Blink detector debug:", message.debug);
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
				this.write({
					target_fps: 10,
					processing_resolution: [320, 240],
				});
			} else if (message.status === SIDECAR_STATUS.cameraReady) {
				this.cameraReady = true;
				this.retryCount = 0;
			}
			return;
		}
		if (message.faceData) {
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
		this.cameraReady = false;
		const isCameraError = ["camera", "permission", "access"].some((term) =>
			message.includes(term),
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
