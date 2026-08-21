import {
	deriveCameraCaptureSurface,
	type CameraCaptureStatusPayload,
} from "../../shared/camera-capture-status";

export interface CameraCaptureStatusWindowsPort {
	sendToMain(channel: string, ...args: unknown[]): void;
}

export class CameraCaptureStatusService {
	private capturing = false;
	private isTracking = false;
	private lastPayload: CameraCaptureStatusPayload | null = null;
	private onState: ((payload: CameraCaptureStatusPayload) => void) | null =
		null;

	constructor(
		private readonly windows: CameraCaptureStatusWindowsPort,
		private readonly channel: string,
	) {}

	setOnState(listener: (payload: CameraCaptureStatusPayload) => void): void {
		this.onState = listener;
	}

	notifyCapture(capturing: boolean): void {
		this.capturing = capturing;
		this.pushState();
	}

	notifyTracking(isTracking: boolean): void {
		this.isTracking = isTracking;
		this.pushState();
	}

	/** Snapshot for late Settings subscribers (force-send even if unchanged). */
	hydrate(capturing: boolean, isTracking: boolean): void {
		this.capturing = capturing;
		this.isTracking = isTracking;
		this.pushState(true);
	}

	/** Re-push current flags (renderer mount / shellReady). */
	pushSnapshot(): void {
		this.pushState(true);
	}

	pushState(force = false): void {
		const surface = deriveCameraCaptureSurface(
			this.capturing,
			this.isTracking,
		);
		const payload: CameraCaptureStatusPayload = {
			capturing: this.capturing,
			surface,
		};
		if (
			!force &&
			this.lastPayload &&
			this.lastPayload.capturing === payload.capturing &&
			this.lastPayload.surface === payload.surface
		) {
			return;
		}
		this.lastPayload = payload;
		this.windows.sendToMain(this.channel, payload);
		this.onState?.(payload);
	}
}
