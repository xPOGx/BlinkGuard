import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	screen: {
		getDisplayMatching: vi.fn(() => ({
			bounds: { x: 0, y: 0, width: 1920, height: 1080 },
		})),
	},
	BrowserWindow: {
		getAllWindows: () => [],
	},
}));

import { createFocusEnvironment } from "../../../electron/infrastructure/focus/create-focus-environment";

describe("createFocusEnvironment", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns unsupported stub on linux", async () => {
		const env = createFocusEnvironment("linux");
		expect(env.supportsFullscreenDetection()).toBe(false);
		expect(env.isOtherAppFullscreen()).toBe(false);
		expect(env.probeForeground()).toEqual({
			isFullscreen: false,
			processName: null,
			windowTitle: null,
		});
		await expect(env.listRunningApps()).resolves.toEqual([]);
	});

	it("returns a supported detector on win32", () => {
		const env = createFocusEnvironment("win32");
		expect(env.supportsFullscreenDetection()).toBe(true);
		env.dispose?.();
	});

	it("returns a supported detector on darwin", () => {
		const env = createFocusEnvironment("darwin");
		expect(env.supportsFullscreenDetection()).toBe(true);
		env.dispose?.();
	});
});
