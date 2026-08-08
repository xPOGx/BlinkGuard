import fs from "node:fs";
import path from "node:path";

/** True when electron-builder embedded a publish feed (e.g. GitHub). */
export function hasUpdateFeed(resourcesPath: string): boolean {
	try {
		if (!resourcesPath) return false;
		return fs.existsSync(path.join(resourcesPath, "app-update.yml"));
	} catch {
		return false;
	}
}
