import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { app, powerMonitor } = vi.hoisted(() => {
	const { EventEmitter } =
		require("node:events") as typeof import("node:events");
	const app = Object.assign(new EventEmitter(), {
		quit: vi.fn(),
	});
	const powerMonitor = { on: vi.fn() };
	return { app, powerMonitor };
});

vi.mock("electron", () => ({ app, powerMonitor }));

import { AppRuntimeState } from "../../../electron/application/app-runtime-state";
import { AppLifecycle } from "../../../electron/infrastructure/lifecycle/app-lifecycle";
import { DEFAULT_PREFERENCES } from "../../../shared/preferences";

describe("AppLifecycle shutdown order", () => {
	beforeEach(() => {
		app.removeAllListeners();
		app.quit.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function createLifecycle(cleanupRun: () => Promise<void>) {
		const destroyAll = vi.fn();
		const lifecycle = new AppLifecycle(
			{ ...DEFAULT_PREFERENCES },
			new AppRuntimeState(),
			{} as never,
			{} as never,
			{} as never,
			{ destroyAll } as never,
			{ run: cleanupRun },
			{ dispose: vi.fn() } as never,
		);
		return { lifecycle, destroyAll };
	}

	it("listens for window-all-closed so Electron does not auto-quit", () => {
		const { lifecycle } = createLifecycle(async () => {});
		lifecycle.register();
		expect(app.listenerCount("window-all-closed")).toBe(1);
	});

	it("stops the sidecar before destroying windows", async () => {
		const order: string[] = [];
		let releaseCleanup: () => void = () => {};
		const cleanupRun = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					order.push("cleanup-start");
					releaseCleanup = () => {
						order.push("cleanup-done");
						resolve();
					};
				}),
		);
		const { lifecycle, destroyAll } = createLifecycle(cleanupRun);
		destroyAll.mockImplementation(() => {
			order.push("destroyAll");
		});
		const shuttingDown = lifecycle.shutdown();
		await Promise.resolve();
		expect(cleanupRun).toHaveBeenCalledTimes(1);
		expect(destroyAll).not.toHaveBeenCalled();
		releaseCleanup();
		await shuttingDown;
		expect(order).toEqual(["cleanup-start", "cleanup-done", "destroyAll"]);
	});
});
