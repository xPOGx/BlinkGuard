import { Download, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/components/setting-panel";
import { useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { author, version } from "../../../../package.json";

const AUTHOR_NAME = author.name;

export function AboutPanel() {
	const t = useT();
	const [exportBusy, setExportBusy] = useState(false);
	const [exportStatus, setExportStatus] = useState<string | null>(null);

	const handleExportDiagnostics = async () => {
		if (exportBusy) return;
		setExportBusy(true);
		setExportStatus(null);
		try {
			const result = await rendererIpc.exportDiagnostics();
			if (result.status === "cancelled") {
				setExportStatus(t("about.exportDiagnostics.cancelled"));
			} else if (result.status === "saved") {
				setExportStatus(
					t("about.exportDiagnostics.success", {
						path: result.path ?? "",
					}),
				);
			} else {
				setExportStatus(
					t("about.exportDiagnostics.error", {
						message: result.message ?? "unknown",
					}),
				);
			}
		} catch (error) {
			setExportStatus(
				t("about.exportDiagnostics.error", {
					message: error instanceof Error ? error.message : String(error),
				}),
			);
		} finally {
			setExportBusy(false);
		}
	};

	return (
		<>
			<SettingPanel>
				<SettingRow
					title={t("about.what.title")}
					description={t("about.what.body")}
				/>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("about.why.title")}
					description={t("about.why.body")}
				/>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("about.privacy.title")}
					description={t("about.privacy.body")}
				/>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("about.opensource.title")}
					description={t("about.opensource.body")}
					action={
						<Button
							type="button"
							variant="secondary"
							onClick={() => rendererIpc.openGithubRepo()}
						>
							<ExternalLink className="mr-2 h-4 w-4" aria-hidden />
							{t("about.opensource.github")}
						</Button>
					}
				/>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("about.exportDiagnostics.title")}
					description={t("about.exportDiagnostics.body")}
					action={
						<Button
							type="button"
							variant="secondary"
							disabled={exportBusy}
							onClick={() => {
								void handleExportDiagnostics();
							}}
						>
							<Download className="mr-2 h-4 w-4" aria-hidden />
							{exportBusy
								? t("about.exportDiagnostics.busy")
								: t("about.exportDiagnostics.button")}
						</Button>
					}
				>
					{exportStatus ? (
						<p className="text-sm text-muted-foreground break-all">
							{exportStatus}
						</p>
					) : null}
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title="BlinkGuard"
					action={
						<Button
							type="button"
							variant="secondary"
							onClick={() => rendererIpc.checkForUpdates()}
						>
							{t("about.checkForUpdates")}
						</Button>
					}
				>
					<p className="text-sm text-muted-foreground">
						{t("about.meta.version", { version })}
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{t("about.meta.author", { name: AUTHOR_NAME })}
					</p>
				</SettingRow>
			</SettingPanel>
		</>
	);
}
