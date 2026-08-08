import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	hasUpdateFeed,
	isAutoUpdatePlatform,
} from "../../../electron/infrastructure/updates/update-feed";

const tempDirs: string[] = [];

afterEach(() => {
	for (const dir of tempDirs.splice(0)) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("isAutoUpdatePlatform", () => {
	it("allows win32 and darwin", () => {
		expect(isAutoUpdatePlatform("win32")).toBe(true);
		expect(isAutoUpdatePlatform("darwin")).toBe(true);
	});

	it("rejects linux and other platforms", () => {
		expect(isAutoUpdatePlatform("linux")).toBe(false);
		expect(isAutoUpdatePlatform("freebsd")).toBe(false);
	});
});

describe("hasUpdateFeed", () => {
	it("returns false when app-update.yml is missing", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blinkguard-update-"));
		tempDirs.push(dir);
		expect(hasUpdateFeed(dir)).toBe(false);
	});

	it("returns true when app-update.yml exists", () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blinkguard-update-"));
		tempDirs.push(dir);
		fs.writeFileSync(
			path.join(dir, "app-update.yml"),
			"provider: github\nowner: xPOGx\nrepo: BlinkGuard\n",
			"utf8",
		);
		expect(hasUpdateFeed(dir)).toBe(true);
	});
});
