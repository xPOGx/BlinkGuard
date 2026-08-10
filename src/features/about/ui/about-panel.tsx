import { ExternalLink, Heart, ScrollText, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/button";
import { SettingPanel } from "@/components/setting-panel";
import { SettingRow } from "@/components/setting-row";
import type { useAutoUpdate } from "@/features/about/model/use-auto-update";
import { ReleaseNotesPanel } from "@/features/about/ui/release-notes-panel";
import { ThanksPanel } from "@/features/about/ui/thanks-panel";
import { useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { author, version } from "../../../../package.json";

const AUTHOR_NAME = author.name;

type AboutPanelProps = {
	autoUpdate: Pick<ReturnType<typeof useAutoUpdate>, "busy" | "check">;
};

export function AboutPanel({ autoUpdate }: AboutPanelProps) {
	const t = useT();
	const [view, setView] = useState<"about" | "release-notes" | "thanks">(
		"about",
	);
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

	if (view === "release-notes") {
		return <ReleaseNotesPanel onBack={() => setView("about")} />;
	}

	if (view === "thanks") {
		return <ThanksPanel onBack={() => setView("about")} />;
	}

	return (
		<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [overflow-anchor:none] px-4 py-4 sm:px-6 sm:py-5">
			<div className="mx-auto flex max-w-3xl flex-col gap-4">
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
						title={t("about.display.title")}
						description={t("about.display.body")}
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
								<Upload className="mr-2 h-4 w-4" aria-hidden />
								{exportBusy
									? t("about.exportDiagnostics.busy")
									: t("about.exportDiagnostics.button")}
							</Button>
						}
					>
						{exportStatus ? (
							<p className="select-text text-sm text-muted-foreground break-all">
								{exportStatus}
							</p>
						) : null}
					</SettingRow>
				</SettingPanel>

				<SettingPanel>
					<SettingRow
						title="BlinkGuard"
						action={
							<div className="flex flex-wrap items-center justify-end gap-2">
								<Button
									type="button"
									variant="secondary"
									onClick={() => setView("release-notes")}
								>
									<ScrollText className="mr-2 h-4 w-4" aria-hidden />
									{t("about.releaseNotes.button")}
								</Button>
								<Button
									type="button"
									variant="secondary"
									onClick={() => setView("thanks")}
								>
									<Heart className="mr-2 h-4 w-4" aria-hidden />
									{t("about.thanks.button")}
								</Button>
								<Button
									type="button"
									variant="secondary"
									disabled={autoUpdate.busy}
									onClick={() => autoUpdate.check()}
								>
									{t("about.checkForUpdates")}
								</Button>
							</div>
						}
					>
						<p className="select-text text-sm text-muted-foreground">
							{t("about.meta.version", { version })}
						</p>
						<p className="mt-1 text-sm text-muted-foreground">
							{t("about.meta.author", { name: AUTHOR_NAME })}
						</p>
					</SettingRow>
				</SettingPanel>
			</div>
		</div>
	);
}
