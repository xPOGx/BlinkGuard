import { exec, type ChildProcess } from "node:child_process";
import { encodeSidecarMessage } from "../sidecar/protocol";
import type { ChildProcessRegistry } from "./child-process-registry";

/** Wait for models/camera release + PyInstaller `_MEI*` delete after stdin quit. */
export const GRACEFUL_SIDECAR_EXIT_MS = 15_000;

function execute(command: string): Promise<void> {
	return new Promise((resolve) => {
		exec(command, (error) => {
			if (error) console.log(`Cleanup command skipped: ${command}`);
			resolve();
		});
	});
}

/** Kill leftover sidecar binaries (HMR / crash orphans). Safe before spawn. */
export async function killOrphanedSidecarProcesses(): Promise<void> {
	if (process.platform === "win32") {
		await execute("taskkill /im blink_detector.exe /f /t");
	} else if (process.platform === "darwin") {
		await execute("pkill -x blink_detector");
		await execute("killall -9 blink_detector");
	} else {
		await execute("pkill -x blink_detector");
	}
}

function requestQuitViaStdin(child: ChildProcess): void {
	const stdin = child.stdin;
	if (!stdin || stdin.destroyed) return;
	try {
		if (!stdin.writableEnded) {
			stdin.end(encodeSidecarMessage({ quit: true }));
		}
	} catch {
		// Pipe already closed.
	}
}

function hasExited(child: ChildProcess): boolean {
	return child.exitCode != null || child.signalCode != null;
}

function waitForExit(
	child: ChildProcess,
	timeoutMs: number,
): Promise<boolean> {
	if (hasExited(child)) return Promise.resolve(true);
	return new Promise((resolve) => {
		const onExit = () => {
			clearTimeout(timer);
			resolve(true);
		};
		const timer = setTimeout(() => {
			child.off("exit", onExit);
			resolve(false);
		}, timeoutMs);
		child.once("exit", onExit);
	});
}

async function forceKill(child: ChildProcess): Promise<void> {
	if (!child.pid) return;
	if (process.platform === "win32") {
		await execute(`taskkill /pid ${child.pid} /t /f`);
		return;
	}
	await execute(`pkill -P ${child.pid}`);
	try {
		process.kill(child.pid, "SIGTERM");
	} catch {
		// Process already exited.
	}
}

export class ProcessCleanup {
	constructor(private readonly processes: ChildProcessRegistry) {}

	async run(): Promise<void> {
		let neededForce = false;
		await Promise.all(
			Array.from(this.processes).map(async (child) => {
				if (!child.pid || child.killed || hasExited(child)) return;
				requestQuitViaStdin(child);
				const exited = await waitForExit(child, GRACEFUL_SIDECAR_EXIT_MS);
				if (!exited && !hasExited(child)) {
					neededForce = true;
					await forceKill(child);
				}
			}),
		);
		this.processes.clear();
		// `/im blink_detector.exe /F` also matches the unpacked copy inside `_MEI*`
		// and can kill the bootloader mid-cleanup. Skip after a clean stdin exit.
		if (neededForce) {
			await killOrphanedSidecarProcesses();
		}
	}
}
