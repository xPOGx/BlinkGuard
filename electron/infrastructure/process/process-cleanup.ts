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

		if (process.platform === "win32") {
			for (const name of [
				"blink_detector.exe",
				"conhost.exe",
				"python.exe",
				"pythonw.exe",
			]) {
				await execute(`taskkill /im ${name} /f /t`);
			}
		} else if (process.platform === "darwin") {
			for (const name of ["blink_detector", "python", "python3"]) {
				await execute(`pkill -f ${name}`);
			}
			await execute('pkill -f "ScreenBlink"');
			await execute("killall -9 blink_detector");
		}
	}
}
