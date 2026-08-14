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

describe("AppLifecycle shutdown order", () => {
	beforeEach(() => {
		app.removeAllListeners();
		app.quit.mockClear();
		powerMonitor.on.mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	function createLifecycle(
		cleanupRun: () => Promise<void>,
		sessionPause = { setPowerFlags: vi.fn() },
	) {
		const destroyAll = vi.fn();
		const lifecycle = new AppLifecycle(
			new AppRuntimeState(),
			sessionPause,
			{ destroyAll } as never,
			{ run: cleanupRun, processes: {} as never } as never,
			{ dispose: vi.fn() } as never,
		);
		return { lifecycle, destroyAll, sessionPause };
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

	it("forwards suspend, resume, lock, and unlock to session pause", () => {
		const handlers = new Map<string, () => void>();
		powerMonitor.on.mockImplementation((event: string, handler: () => void) => {
			handlers.set(event, handler);
		});
		const { lifecycle, sessionPause } = createLifecycle(async () => {});
		lifecycle.register();

		handlers.get("suspend")?.();
		expect(sessionPause.setPowerFlags).toHaveBeenCalledWith({
			suspended: true,
		});
		handlers.get("resume")?.();
		expect(sessionPause.setPowerFlags).toHaveBeenCalledWith({
			suspended: false,
		});
		handlers.get("lock-screen")?.();
		expect(sessionPause.setPowerFlags).toHaveBeenCalledWith({ locked: true });
		handlers.get("unlock-screen")?.();
		expect(sessionPause.setPowerFlags).toHaveBeenCalledWith({ locked: false });
	});
});
