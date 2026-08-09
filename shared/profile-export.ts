export type ExportProfileImageStatus = "saved" | "cancelled" | "error";

export interface ExportProfileImageResult {
	status: ExportProfileImageStatus;
	path?: string;
	message?: string;
}
