export type FocusPauseReason = "quiet-hours" | "fullscreen" | null;

const HH_MM = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

/** Minutes since midnight, or null when the string is not a valid local HH:mm. */
export function parseQuietHoursMinutes(value: string): number | null {
	const match = HH_MM.exec(value.trim());
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (
		!Number.isInteger(hours) ||
		!Number.isInteger(minutes) ||
		hours < 0 ||
		hours > 23 ||
		minutes < 0 ||
		minutes > 59
	) {
		return null;
	}
	return hours * 60 + minutes;
}

export function isValidQuietHoursTime(value: string): boolean {
	return parseQuietHoursMinutes(value) !== null;
}

/** Normalize to zero-padded HH:mm for storage / time inputs. */
export function normalizeQuietHoursTime(value: string): string | null {
	const minutes = parseQuietHoursMinutes(value);
	if (minutes === null) return null;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * True when local clock is inside [start, end).
 * Overnight windows (e.g. 22:00–08:00) wrap midnight.
 * Equal start/end is treated as an empty window (never quiet).
 */
export function isInQuietHours(
	now: Date,
	start: string,
	end: string,
): boolean {
	const startMinutes = parseQuietHoursMinutes(start);
	const endMinutes = parseQuietHoursMinutes(end);
	if (startMinutes === null || endMinutes === null) return false;
	if (startMinutes === endMinutes) return false;

	const nowMinutes = now.getHours() * 60 + now.getMinutes();
	if (startMinutes < endMinutes) {
		return nowMinutes >= startMinutes && nowMinutes < endMinutes;
	}
	return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function resolveFocusPauseReason(input: {
	quietHoursEnabled: boolean;
	inQuietHours: boolean;
	pauseOnFullscreen: boolean;
	isFullscreen: boolean;
}): FocusPauseReason {
	if (input.quietHoursEnabled && input.inQuietHours) return "quiet-hours";
	if (input.pauseOnFullscreen && input.isFullscreen) return "fullscreen";
	return null;
}

export function shouldSuppressNotifications(input: {
	quietHoursEnabled: boolean;
	inQuietHours: boolean;
	pauseOnFullscreen: boolean;
	isFullscreen: boolean;
}): boolean {
	return resolveFocusPauseReason(input) !== null;
}
