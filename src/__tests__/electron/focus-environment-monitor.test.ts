import { describe, expect, it, vi } from "vitest";
import type { FocusEnvironmentPort } from "../../../electron/application/ports/focus-environment-port";
import { FocusEnvironmentMonitor } from "../../../electron/infrastructure/focus/focus-environment-monitor";

describe("FocusEnvironmentMonitor", () => {
	it("notifies when process identity changes without a fullscreen edge", () => {
		const snapshot = {
			isFullscreen: false,
			processName: "Zoom.exe",
			windowTitle: "Zoom Meeting",
		};
		const environment: FocusEnvironmentPort = {
			isOtherAppFullscreen: () => false,
			probeForeground: () => snapshot,
			listRunningApps: async () => [],
			supportsFullscreenDetection: () => true,
		};
		const onChange = vi.fn();
		const monitor = new FocusEnvironmentMonitor(environment, onChange);

		monitor.start(60_000);
		expect(onChange).toHaveBeenCalledWith(snapshot);

		monitor.start(60_000);
		expect(onChange).toHaveBeenCalledTimes(1);
		monitor.stop();
	});
});
