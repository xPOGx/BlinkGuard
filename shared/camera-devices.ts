/** Preferred capture device persisted in prefs. `null` = Automatic (index scan). */
export type CameraDevicePref = {
	id: string;
	index: number;
	name: string;
};

/** One row from sidecar `camera_devices` inventory (OS index is soft). */
export type CameraDeviceInfo = {
	index: number;
	name: string;
	id: string;
};

export type CameraDevicesPayload = {
	devices: CameraDeviceInfo[];
	unavailable?: boolean;
};

export type CameraDeviceNoticeCode = "missing" | "fallback";

export type CameraDeviceNotice = {
	code: CameraDeviceNoticeCode;
	name: string;
};

export const CAMERA_DEVICE_INDEX_MIN = 0;
export const CAMERA_DEVICE_INDEX_MAX = 4;
export const CAMERA_DEVICE_ID_MAX = 256;
export const CAMERA_DEVICE_NAME_MAX = 128;
export const LIST_CAMERAS_TIMEOUT_MS = 8000;

export function emptyCameraDevicesPayload(): CameraDevicesPayload {
	return { devices: [] };
}

export function sameCameraDevice(
	a: CameraDevicePref | null,
	b: CameraDevicePref | null,
): boolean {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.id === b.id && a.index === b.index && a.name === b.name;
}

function clipString(value: unknown, max: number): string {
	if (typeof value !== "string") return "";
	return value.trim().slice(0, max);
}

function sanitizeIndex(value: unknown): number | null {
	const n = typeof value === "number" ? value : Number(value);
	if (!Number.isInteger(n)) return null;
	if (n < CAMERA_DEVICE_INDEX_MIN || n > CAMERA_DEVICE_INDEX_MAX) {
		return null;
	}
	return n;
}

/** Coerce stored/IPC preferred device; invalid → Automatic (`null`). */
export function sanitizeCameraDevice(input: unknown): CameraDevicePref | null {
	if (input == null) return null;
	if (typeof input !== "object") return null;
	const record = input as Record<string, unknown>;
	const index = sanitizeIndex(record.index);
	if (index === null) return null;
	const id = clipString(record.id, CAMERA_DEVICE_ID_MAX);
	const name = clipString(record.name, CAMERA_DEVICE_NAME_MAX);
	if (!id && !name) return null;
	return { id, index, name };
}

export function sanitizeCameraDeviceInfo(
	input: unknown,
): CameraDeviceInfo | null {
	if (!input || typeof input !== "object") return null;
	const record = input as Record<string, unknown>;
	const index = sanitizeIndex(record.index);
	if (index === null) return null;
	const id = clipString(record.id, CAMERA_DEVICE_ID_MAX);
	const name = clipString(record.name, CAMERA_DEVICE_NAME_MAX);
	if (!id && !name) return null;
	return { id, index, name: name || `Camera ${index}` };
}

export function sanitizeCameraDevicesPayload(
	input: unknown,
): CameraDevicesPayload {
	if (!input || typeof input !== "object") return emptyCameraDevicesPayload();
	const record = input as Record<string, unknown>;
	const raw = Array.isArray(record.devices) ? record.devices : [];
	const devices: CameraDeviceInfo[] = [];
	const seen = new Set<string>();
	for (const item of raw) {
		const device = sanitizeCameraDeviceInfo(item);
		if (!device) continue;
		const key = cameraDeviceOptionValue(device);
		if (seen.has(key)) continue;
		seen.add(key);
		devices.push(device);
	}
	return {
		devices,
		...(Boolean(record.unavailable) ? { unavailable: true } : {}),
	};
}

export function sanitizeCameraDeviceNotice(
	input: unknown,
): CameraDeviceNotice | null {
	if (!input || typeof input !== "object") return null;
	const record = input as Record<string, unknown>;
	const code = record.code;
	if (code !== "missing" && code !== "fallback") return null;
	return {
		code,
		name: clipString(record.name, CAMERA_DEVICE_NAME_MAX),
	};
}

/** Stable `<option>` value: prefer OS id, else name+index. */
export function cameraDeviceOptionValue(
	device: Pick<CameraDeviceInfo, "id" | "name" | "index">,
): string {
	if (device.id) return `id:${device.id}`;
	return `name:${device.name}:${device.index}`;
}

export function findCameraDeviceByOptionValue(
	devices: CameraDeviceInfo[],
	value: string,
): CameraDeviceInfo | null {
	return (
		devices.find((device) => cameraDeviceOptionValue(device) === value) ??
		null
	);
}

/** Wire format for blink-detector stdin (sibling to `start_camera`). */
export function toSidecarCameraDeviceMessage(device: CameraDevicePref | null): {
	camera_device: CameraDevicePref | null;
} {
	return { camera_device: device };
}
