import { describe, expect, it, vi } from "vitest";
import { CameraCaptureStatusService } from "../../../electron/application/camera-capture-status-service";

function makeService() {
	const sendToMain = vi.fn();
	const onState = vi.fn();
	const service = new CameraCaptureStatusService(
		{ sendToMain },
		"camera-capture-status",
	);
	service.setOnState(onState);
	return { service, sendToMain, onState };
}

describe("CameraCaptureStatusService", () => {
	it("hydrates and notifies the derive matrix", () => {
		const { service, sendToMain, onState } = makeService();

		service.hydrate(false, true);
		expect(sendToMain).toHaveBeenLastCalledWith("camera-capture-status", {
			capturing: false,
			surface: "idle",
		});

		service.notifyCapture(true);
		expect(onState).toHaveBeenLastCalledWith({
			capturing: true,
			surface: "monitoring",
		});

		service.hydrate(true, false);
		expect(onState).toHaveBeenLastCalledWith({
			capturing: true,
			surface: "preview",
		});
	});

	it("skips duplicate identical payloads", () => {
		const { service, sendToMain, onState } = makeService();
		service.notifyCapture(true);
		service.notifyTracking(true);
		expect(sendToMain).toHaveBeenCalledTimes(2);
		expect(onState).toHaveBeenLastCalledWith({
			capturing: true,
			surface: "monitoring",
		});
		service.notifyCapture(true);
		service.notifyTracking(true);
		expect(sendToMain).toHaveBeenCalledTimes(2);
		expect(onState).toHaveBeenCalledTimes(2);
	});

	it("hydrate force-sends even when the payload is unchanged", () => {
		const { service, sendToMain } = makeService();
		service.hydrate(true, true);
		expect(sendToMain).toHaveBeenCalledTimes(1);
		service.hydrate(true, true);
		expect(sendToMain).toHaveBeenCalledTimes(2);
		service.pushSnapshot();
		expect(sendToMain).toHaveBeenCalledTimes(3);
	});

	it("flips preview to monitoring on tracking without a capture flip", () => {
		const { service, onState } = makeService();
		service.hydrate(true, false);
		expect(onState).toHaveBeenLastCalledWith({
			capturing: true,
			surface: "preview",
		});
		service.notifyTracking(true);
		expect(onState).toHaveBeenLastCalledWith({
			capturing: true,
			surface: "monitoring",
		});
	});

	it("goes idle on capture false while tracking stays true (soft pause)", () => {
		const { service, onState } = makeService();
		service.hydrate(true, true);
		service.notifyCapture(false);
		expect(onState).toHaveBeenLastCalledWith({
			capturing: false,
			surface: "idle",
		});
	});

	it("stays idle when tracking flips without a capture ACK", () => {
		const { service, onState, sendToMain } = makeService();
		service.notifyTracking(true);
		expect(onState).toHaveBeenLastCalledWith({
			capturing: false,
			surface: "idle",
		});
		service.notifyTracking(false);
		expect(sendToMain).toHaveBeenCalledTimes(1);
		expect(onState).toHaveBeenLastCalledWith({
			capturing: false,
			surface: "idle",
		});
	});
});
