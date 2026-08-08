export type ExportDiagnosticsStatus = "saved" | "cancelled" | "error";

export interface ExportDiagnosticsResult {
	status: ExportDiagnosticsStatus;
	path?: string;
	message?: string;
}
