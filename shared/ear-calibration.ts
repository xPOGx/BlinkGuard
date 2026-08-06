/** Plausible open-eye EAR range for dlib 68-pt EAR. */
export const EAR_CALIBRATION_MIN = 0.12;
export const EAR_CALIBRATION_MAX = 0.45;

/** Default open-eye calibration window (within the 5–10s UX guidance). */
export const EAR_CALIBRATION_DURATION_MS = 8_000;

/** Minimum accepted face frames with a usable EAR during the window. */
export const EAR_CALIBRATION_MIN_SAMPLES = 12;

export function isValidEarCalibration(value: unknown): value is number {
	return (
		typeof value === "number" &&
		Number.isFinite(value) &&
		value >= EAR_CALIBRATION_MIN &&
		value <= EAR_CALIBRATION_MAX
	);
}

/** Median of open-eye EAR samples, or null if too few / out of range. */
export function medianEarCalibration(samples: number[]): number | null {
	const filtered = samples.filter(
		(ear) =>
			typeof ear === "number" &&
			Number.isFinite(ear) &&
			ear >= EAR_CALIBRATION_MIN &&
			ear <= EAR_CALIBRATION_MAX,
	);
	if (filtered.length < EAR_CALIBRATION_MIN_SAMPLES) return null;

	const sorted = [...filtered].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	const median =
		sorted.length % 2 === 0
			? (sorted[mid - 1] + sorted[mid]) / 2
			: sorted[mid];
	return isValidEarCalibration(median) ? median : null;
}
