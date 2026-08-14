import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChildProcessRegistry } from "../../../electron/infrastructure/process/child-process-registry";
import { BlinkDetectorSidecar } from "../../../electron/infrastructure/sidecar/blink-detector-sidecar";
import { SIDECAR_STATUS, isBenignSidecarStderr } from "../../../electron/infrastructure/sidecar/protocol";
import { DEFAULT_PREFERENCES } from "../../../shared/preferences";

type FakeChild = EventEmitter & {
	pid: number;
	killed: boolean;
	stdin: { write: (chunk: string) => boolean };
	stdout: EventEmitter;
	stderr: EventEmitter;
};

function createFakeChild(): { child: FakeChild; stdinChunks: string[] } {
	const stdinChunks: string[] = [];
	const child = new EventEmitter() as FakeChild;
	child.pid = 4242;
	child.killed = false;
	child.stdin = {
		write: (chunk: string) => {
			stdinChunks.push(chunk);
			return true;
		},
	};
	child.stdout = new EventEmitter();
	child.stderr = new EventEmitter();
	return { child, stdinChunks };
}

function parseWrites(chunks: string[]): Record<string, unknown>[] {
	return chunks
		.join("")
		.split("\n")
		.filter(Boolean)
		.map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** Bypass spawn/binary path; attach a fake child as if start() succeeded. */
function attachRunningProcess(
	sidecar: BlinkDetectorSidecar,
	fakeChild: FakeChild,
): void {
	const internal = sidecar as unknown as {
		process: FakeChild | null;
		running: boolean;
		readStdout: (process: FakeChild) => void;
	};
	internal.process = fakeChild;
	internal.running = true;
	internal.readStdout(fakeChild);
}

describe("BlinkDetectorSidecar preview restore", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function createSidecar(isCameraWindowOpen: () => boolean) {
		const { child, stdinChunks } = createFakeChild();
		const sidecar = new BlinkDetectorSidecar(
			{
				root: "/app",
				publicDir: "/app/public",
				preload: "/app/preload.js",
			} as never,
			false,
			new ChildProcessRegistry(),
			{ ...DEFAULT_PREFERENCES },
			{
				onBlink: vi.fn(),
				onFaceData: vi.fn(),
				onVideoStream: vi.fn(),
				onError: vi.fn(),
				onCameraReady: vi.fn(),
				shouldRetryCamera: () => true,
				isCameraWindowOpen,
			},
		);
		attachRunningProcess(sidecar, child);
		return { sidecar, stdinChunks, child };
	}

	it("re-requests video after stop→start flush when preview window is open", () => {
		const { sidecar, stdinChunks } = createSidecar(() => true);
		expect(sidecar.startCamera()).toBe(true);
		vi.advanceTimersByTime(75);
		const afterStart = parseWrites(stdinChunks);
		expect(afterStart.some((m) => m.start_camera === true)).toBe(true);
		expect(afterStart.some((m) => m.request_video === true)).toBe(true);

		stdinChunks.length = 0;
		sidecar.stopCamera();
		expect(sidecar.startCamera()).toBe(true);
		vi.advanceTimersByTime(75);
		const afterRestart = parseWrites(stdinChunks);
		expect(afterRestart.some((m) => m.stop_camera === true)).toBe(true);
		expect(afterRestart.some((m) => m.start_camera === true)).toBe(true);
		expect(afterRestart.some((m) => m.request_video === true)).toBe(true);
	});

	it("does not request video after flush start when preview window is closed", () => {
		const { sidecar, stdinChunks } = createSidecar(() => false);
		expect(sidecar.startCamera()).toBe(true);
		vi.advanceTimersByTime(75);
		const writes = parseWrites(stdinChunks);
		expect(writes.some((m) => m.start_camera === true)).toBe(true);
		expect(writes.some((m) => m.request_video === true)).toBe(false);
	});

	it("re-requests video on cameraStarted when preview window is open", () => {
		const { sidecar, stdinChunks, child } = createSidecar(() => true);
		stdinChunks.length = 0;
		child.stdout.emit(
			"data",
			Buffer.from(
				`${JSON.stringify({ status: SIDECAR_STATUS.cameraStarted })}\n`,
			),
		);
		expect(sidecar.isCameraReady).toBe(true);
		expect(parseWrites(stdinChunks)).toEqual([{ request_video: true }]);
	});

	it("does not request video on cameraStarted when preview window is closed", () => {
		const { sidecar, stdinChunks, child } = createSidecar(() => false);
		stdinChunks.length = 0;
		child.stdout.emit(
			"data",
			Buffer.from(
				`${JSON.stringify({ status: SIDECAR_STATUS.cameraStarted })}\n`,
			),
		);
		expect(sidecar.isCameraReady).toBe(true);
		expect(parseWrites(stdinChunks)).toEqual([]);
	});
});

describe("BlinkDetectorSidecar EAR calibration samples", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function createSidecar() {
		const { child } = createFakeChild();
		const sidecar = new BlinkDetectorSidecar(
			{
				root: "/app",
				publicDir: "/app/public",
				preload: "/app/preload.js",
			} as never,
			false,
			new ChildProcessRegistry(),
			{ ...DEFAULT_PREFERENCES },
			{
				onBlink: vi.fn(),
				onFaceData: vi.fn(),
				onVideoStream: vi.fn(),
				onError: vi.fn(),
				onCameraReady: vi.fn(),
				shouldRetryCamera: () => true,
			},
		);
		attachRunningProcess(sidecar, child);
		return { sidecar, child };
	}

	function emitFaceData(
		child: FakeChild,
		faceData: Record<string, unknown>,
	): void {
		child.stdout.emit(
			"data",
			Buffer.from(`${JSON.stringify({ faceData })}\n`),
		);
	}

	it("samples Phase A EAR only when faceStatus is ok", () => {
		const { sidecar, child } = createSidecar();
		expect(sidecar.startEarCalibration()).toBe(true);
		const internal = sidecar as unknown as { calibrationSamples: number[] };

		emitFaceData(child, {
			faceDetected: true,
			faceStatus: "too_far",
			ear: 0.214,
		});
		emitFaceData(child, {
			faceDetected: true,
			faceStatus: "none",
			ear: 0.2,
		});
		emitFaceData(child, {
			faceDetected: true,
			faceStatus: "ok",
			ear: 0.28,
		});

		expect(internal.calibrationSamples).toEqual([0.28]);
	});
});

describe("isBenignSidecarStderr", () => {
	it("ignores OpenCV YuNet graph-engine target warn", () => {
		expect(
			isBenignSidecarStderr(
				"[ WARN:0@0.239] global net_impl_backend.cpp:345 cv::dnn::dnn5_v20260605::Net::Impl::setPreferableTarget Targets are not supported by the new graph engine for now",
			),
		).toBe(true);
		expect(isBenignSidecarStderr("camera open failed")).toBe(false);
	});
});

describe("BlinkDetectorSidecar NDJSON routing", () => {
	function createSidecar() {
		const { child } = createFakeChild();
		const callbacks = {
			onBlink: vi.fn(),
			onFaceData: vi.fn(),
			onVideoStream: vi.fn(),
			onError: vi.fn(),
			onCameraReady: vi.fn(),
			shouldRetryCamera: () => false,
		};
		const sidecar = new BlinkDetectorSidecar(
			{
				root: "/app",
				publicDir: "/app/public",
				preload: "/app/preload.js",
			} as never,
			false,
			new ChildProcessRegistry(),
			{ ...DEFAULT_PREFERENCES },
			callbacks,
		);
		attachRunningProcess(sidecar, child);
		return { sidecar, child, callbacks };
	}

	function emitJson(child: FakeChild, payload: Record<string, unknown>): void {
		child.stdout.emit(
			"data",
			Buffer.from(`${JSON.stringify(payload)}\n`),
		);
	}

	it("routes blink, faceData, error, cameraReady, and videoStream", () => {
		const { sidecar, child, callbacks } = createSidecar();

		emitJson(child, { blink: true, ear: 0.12, time: 1.5 });
		expect(callbacks.onBlink).toHaveBeenCalledWith({
			blink: true,
			ear: 0.12,
			time: 1.5,
		});

		const faceData = { faceDetected: true, faceStatus: "ok", ear: 0.28 };
		emitJson(child, { faceData });
		expect(callbacks.onFaceData).toHaveBeenCalledWith(faceData);

		emitJson(child, { error: "permission denied for camera" });
		expect(callbacks.onError).toHaveBeenCalledWith(
			"permission denied for camera",
		);

		emitJson(child, { status: SIDECAR_STATUS.cameraReady });
		expect(sidecar.isCameraReady).toBe(true);
		expect(callbacks.onCameraReady).toHaveBeenCalledOnce();

		const frame = { jpeg: "abc" };
		emitJson(child, { videoStream: frame });
		expect(callbacks.onVideoStream).toHaveBeenCalledWith(frame);
	});

	it("ignores cameraState without treating it as a user-facing error", () => {
		const { child, callbacks } = createSidecar();
		emitJson(child, {
			cameraState: { open: true, backend: "MSMF", black_ratio: 0 },
		});
		expect(callbacks.onError).not.toHaveBeenCalled();
		expect(callbacks.onBlink).not.toHaveBeenCalled();
		expect(callbacks.onFaceData).not.toHaveBeenCalled();
		expect(callbacks.onCameraReady).not.toHaveBeenCalled();
	});

	it("skips invalid JSON lines without calling callbacks", () => {
		const { child, callbacks } = createSidecar();
		child.stdout.emit("data", Buffer.from("not-json\n"));
		expect(callbacks.onBlink).not.toHaveBeenCalled();
		expect(callbacks.onError).not.toHaveBeenCalled();
	});

	it("assembles a blink message split across stdout chunks", () => {
		const { child, callbacks } = createSidecar();
		child.stdout.emit("data", Buffer.from('{"blink":true,'));
		expect(callbacks.onBlink).not.toHaveBeenCalled();
		child.stdout.emit("data", Buffer.from('"ear":0.2}\n'));
		expect(callbacks.onBlink).toHaveBeenCalledWith({
			blink: true,
			ear: 0.2,
		});
	});
});
