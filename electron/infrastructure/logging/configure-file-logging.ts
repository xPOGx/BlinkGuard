import { existsSync, createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";

export function configureFileLogging(): void {
	if (process.platform !== "win32") return;
	const logPath = path.join(
		process.env.APPDATA || process.env.USERPROFILE || "",
		"ScreenBlink",
		"app.log",
	);
	const directory = path.dirname(logPath);
	if (!existsSync(directory)) {
		try {
			mkdirSync(directory, { recursive: true });
		} catch (error) {
			console.error("Failed to create log directory:", error);
			return;
		}
	}
	const stream = createWriteStream(logPath, { flags: "a" });
	const originalLog = console.log;
	const originalError = console.error;
	console.log = (...args) => {
		stream.write(`[${new Date().toISOString()}] LOG: ${args.join(" ")}\n`);
		originalLog(...args);
	};
	console.error = (...args) => {
		stream.write(`[${new Date().toISOString()}] ERROR: ${args.join(" ")}\n`);
		originalError(...args);
	};
	console.log("ScreenBlink app started - logs will be written to:", logPath);
}
