export interface BlinkStatsPort {
	recordBlink(): void;
	onTrackingStart(): void;
	onTrackingStop(): void;
}

export interface BlinkRateCoachingPort {
	start(): void;
	stop(): void;
}
