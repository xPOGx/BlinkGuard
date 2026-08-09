import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BlinkDetectorSidecar } from "../../../electron/infrastructure/sidecar/blink-detector-sidecar";
import { SIDECAR_STATUS } from "../../../electron/infrastructure/sidecar/protocol";
import { ChildProcessRegistry } from "../../../electron/infrastructure/process/child-process-registry";
import { DEFAULT_PREFERENCES } from "../../../shared/preferences";

function createFakeChild() {
	const stdinChunks: string[] = [];
	const child = new EventEmitter() as EventEmitter & {
		pid: number;
		killed: boolean;
		stdin: { write: (chunk: string) => boolean };
		stdout: EventEmitter;
		stderr: EventEmitter;
	};
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
	child: ReturnType<typeof createFakeChild>["child"],
): void {
	const internal = sidecar as unknown as {
		process: typeof child | null;
		running: boolean;
		readStdout: (child: typeof child) => void;
	};
	internal.process = child;
	internal.running = true;
	internal.readStdout(child);
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
