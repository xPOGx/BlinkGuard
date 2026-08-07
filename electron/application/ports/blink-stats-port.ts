export interface BlinkStatsPort {
	recordBlink(): void;
	onTrackingStart(): void;
	onTrackingStop(): void;
}
