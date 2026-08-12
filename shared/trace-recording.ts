/** Result of Debug → start/stop EAR-trace recording (sidecar NDJSON). */

export type TraceRecordingStatus = "started" | "stopped" | "cancelled" | "error";

export interface TraceRecordingResult {
	status: TraceRecordingStatus;
	path?: string;
	message?: string;
}
