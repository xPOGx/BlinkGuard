export interface BlinkStatsPort {
	recordBlink(): void;
	onTrackingStart(): void;
	onTrackingStop(): void;
	/** Raw camera face presence for coverage BPM / face-only trackingMs. */
	onFaceVisibility(visible: boolean): void;
	/**
	 * Camera face-aware → true; MGD / timer-only → false.
	 * Controls whether BPM and trackingMs use face-visible time.
	 */
	setFaceCoverageMode(enabled: boolean): void;
}

export interface BlinkRateCoachingPort {
	start(): void;
	stop(): void;
}

export interface CalibrationNudgePort {
	start(): void;
	stop(): void;
	onDriftNudge(nowMs?: number): void;
}
