import { exec } from "node:child_process";
import type { ChildProcessRegistry } from "./child-process-registry";

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

export class ProcessCleanup {
	constructor(private readonly processes: ChildProcessRegistry) {}

	async run(): Promise<void> {
		await Promise.all(
			Array.from(this.processes).map(async (child) => {
				if (!child.pid || child.killed) return;
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
			}),
		);
		this.processes.clear();
		await killOrphanedSidecarProcesses();
	}
}
