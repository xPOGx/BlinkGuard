export const SIDECAR_STATUS = {
	modelsReady: "Models loaded successfully, ready for camera activation",
	cameraReady: "Camera opened successfully",
	/** Detector ACK after start_camera (also emitted when camera was already active). */
	cameraStarted: "Camera started successfully",
} as const;

export function encodeSidecarMessage(message: object): string {
	return `${JSON.stringify(message)}\n`;
}

/** OpenCV DNN/MSMF noise — capture still works; do not treat as a sidecar error. */
export function isBenignSidecarStderr(text: string): boolean {
	return /setPreferableTarget|new graph engine for now/i.test(text);
}

export class NdjsonBuffer {
	private buffer = "";

	push(chunk: Buffer | string): string[] {
		this.buffer += chunk.toString();
		const messages: string[] = [];
		let newlineIndex = this.buffer.indexOf("\n");
		while (newlineIndex !== -1) {
			messages.push(this.buffer.slice(0, newlineIndex));
			this.buffer = this.buffer.slice(newlineIndex + 1);
			newlineIndex = this.buffer.indexOf("\n");
		}
		return messages;
	}
}

export const BASELINE_DRIFT_NUDGE_PHASE = "baseline_drift_nudge";

export type BaselineDriftNudgePayload = {
	baseline_before?: number;
	baseline?: number;
	live_open_ear?: number;
	drift_ratio?: number;
};

function optionalFiniteNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

/** Promote sidecar blinkDebug.phase === baseline_drift_nudge into a typed payload. */
export function parseBaselineDriftNudge(
	debug: unknown,
): BaselineDriftNudgePayload | null {
	if (!debug || typeof debug !== "object") return null;
	const record = debug as Record<string, unknown>;
	if (record.phase !== BASELINE_DRIFT_NUDGE_PHASE) return null;
	return {
		baseline_before: optionalFiniteNumber(record.baseline_before),
		baseline: optionalFiniteNumber(record.baseline),
		live_open_ear: optionalFiniteNumber(record.live_open_ear),
		drift_ratio: optionalFiniteNumber(record.drift_ratio),
	};
}
