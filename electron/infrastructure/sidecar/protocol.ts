export const SIDECAR_STATUS = {
	modelsReady: "Models loaded successfully, ready for camera activation",
	cameraReady: "Camera opened successfully",
	/** Detector ACK after start_camera (also emitted when camera was already active). */
	cameraStarted: "Camera started successfully",
} as const;

export function encodeSidecarMessage(message: object): string {
	return `${JSON.stringify(message)}\n`;
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
