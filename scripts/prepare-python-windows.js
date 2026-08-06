import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ensures electron/resources/blink_detector.exe exists before Windows packaging.
 * Prefers an already-built binary; otherwise runs python/build_and_install.bat
 * (venv + dlib pipeline) rather than invoking system Python directly.
 */
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "python", "dist", "blink_detector.exe");
const targetDir = join(root, "electron", "resources");
const target = join(targetDir, "blink_detector.exe");
const buildBat = join(root, "python", "build_and_install.bat");

function fail(message) {
	console.error(message);
	process.exit(1);
}

if (existsSync(target)) {
	console.log(`Python detector already prepared: ${target}`);
	process.exit(0);
}

if (!existsSync(source)) {
	if (!existsSync(buildBat)) {
		fail(
			`blink_detector.exe missing and ${buildBat} not found. Run python/setup.bat then python/build_and_install.bat.`,
		);
	}
	console.log("blink_detector.exe not found; building via build_and_install.bat...");
	const result = spawnSync(buildBat, [], {
		cwd: join(root, "python"),
		stdio: "inherit",
		shell: true,
	});
	if (result.status !== 0) {
		process.exit(result.status ?? 1);
	}
}

if (existsSync(target)) {
	console.log(`Prepared Python detector: ${target}`);
	process.exit(0);
}

if (!existsSync(source)) {
	fail(`Expected Python binary was not created: ${source}`);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log(`Prepared Python detector: ${target}`);
