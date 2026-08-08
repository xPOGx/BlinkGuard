import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AutoUpdateStatus } from "../../../shared/auto-update";

const { showMessageBox, checkForUpdatesMock, quitAndInstall, autoUpdater } =
	vi.hoisted(() => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { EventEmitter } =
			require("node:events") as typeof import("node:events");
		const checkForUpdatesMock = vi.fn(() => Promise.resolve(null));
		const quitAndInstall = vi.fn();
		const showMessageBox = vi.fn(() => Promise.resolve({ response: 1 }));
		const autoUpdater = Object.assign(new EventEmitter(), {
			autoDownload: false,
			autoInstallOnAppQuit: false,
			checkForUpdates: checkForUpdatesMock,
			quitAndInstall,
		});
		return {
			showMessageBox,
			checkForUpdatesMock,
			quitAndInstall,
			autoUpdater,
		};
	});

vi.mock("electron", () => ({
	app: { isPackaged: true },
	dialog: { showMessageBox },
}));

vi.mock("electron-updater", () => ({
	default: { autoUpdater },
}));

vi.mock("../../../electron/infrastructure/updates/update-feed", () => ({
	isAutoUpdatePlatform: () => true,
	hasUpdateFeed: () => true,
}));

import { AutoUpdateService } from "../../../electron/infrastructure/updates/auto-update-service";

describe("AutoUpdateService", () => {
	let emitted: AutoUpdateStatus[];
	let ensureVisibleCalls: number;
	let canHost: boolean;

	beforeEach(() => {
		emitted = [];
		ensureVisibleCalls = 0;
		canHost = true;
		autoUpdater.removeAllListeners();
		checkForUpdatesMock.mockClear();
		checkForUpdatesMock.mockImplementation(() => Promise.resolve(null));
		quitAndInstall.mockClear();
		showMessageBox.mockClear();
	});

	function createService(): AutoUpdateService {
		return new AutoUpdateService(() => "en", {
			emit: (status) => {
				emitted.push(status);
			},
			ensureVisible: () => {
				ensureVisibleCalls += 1;
			},
			canHostInAppUi: () => canHost,
		});
	}

	it("emits unavailable for interactive check when disabled", () => {
		const service = createService();
		service.checkForUpdates({ interactive: true });
		expect(emitted).toEqual([{ state: "unavailable" }]);
		expect(ensureVisibleCalls).toBeGreaterThan(0);
		expect(checkForUpdatesMock).not.toHaveBeenCalled();
	});

	it("quiet check does not emit when disabled", () => {
		const service = createService();
		service.checkForUpdates();
		expect(emitted).toEqual([]);
	});

	it("interactive check emits checking then upToDate", () => {
		const service = createService();
		service.start();
		service.checkForUpdates({ interactive: true });
		expect(emitted).toEqual([{ state: "checking" }]);
		autoUpdater.emit("update-not-available");
		expect(emitted.at(-1)).toEqual({ state: "upToDate" });
	});

	it("quiet check skips upToDate emit", () => {
		const service = createService();
		service.start();
		service.checkForUpdates();
		autoUpdater.emit("update-not-available");
		expect(emitted).toEqual([]);
	});

	it("emits available, downloading, then ready for interactive download", () => {
		const service = createService();
		service.start();
		service.checkForUpdates({ interactive: true });
		autoUpdater.emit("update-available", { version: "2.0.0" });
		autoUpdater.emit("download-progress", { percent: 42.6 });
		autoUpdater.emit("update-downloaded", { version: "2.0.0" });
		expect(emitted).toEqual([
			{ state: "checking" },
			{ state: "available", version: "2.0.0" },
			{ state: "downloading", version: "2.0.0", percent: 43 },
			{ state: "ready", version: "2.0.0" },
		]);
	});

	it("quiet path emits ready on download complete", () => {
		const service = createService();
		service.start();
		service.checkForUpdates();
		autoUpdater.emit("update-available", { version: "2.1.0" });
		autoUpdater.emit("download-progress", { percent: 10 });
		autoUpdater.emit("update-downloaded", { version: "2.1.0" });
		expect(emitted).toEqual([{ state: "ready", version: "2.1.0" }]);
	});

	it("installUpdate calls quitAndInstall after download", () => {
		const service = createService();
		service.start();
		service.checkForUpdates({ interactive: true });
		autoUpdater.emit("update-downloaded", { version: "3.0.0" });
		service.installUpdate();
		expect(quitAndInstall).toHaveBeenCalledWith(false, true);
	});

	it("re-presents ready when already downloaded", () => {
		const service = createService();
		service.start();
		service.checkForUpdates({ interactive: true });
		autoUpdater.emit("update-downloaded", { version: "3.0.0" });
		emitted.length = 0;
		service.checkForUpdates({ interactive: true });
		expect(emitted).toEqual([
			{ state: "checking" },
			{ state: "ready", version: "3.0.0" },
		]);
	});

	it("uses native dialog fallback when main window cannot host UI", () => {
		canHost = false;
		const service = createService();
		service.start();
		service.checkForUpdates({ interactive: true });
		autoUpdater.emit("update-not-available");
		expect(emitted).toEqual([]);
		expect(showMessageBox).toHaveBeenCalled();
		expect(ensureVisibleCalls).toBe(0);
	});
});
