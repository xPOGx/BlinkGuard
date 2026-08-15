import { ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/button";
import { SettingPanel } from "@/components/setting-panel";
import { SettingRow } from "@/components/setting-row";
import { useReleaseNotes } from "@/features/about/model/use-release-notes";
import { SimpleMarkdown } from "@/features/about/ui/simple-markdown";
import { useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";

type ReleaseNotesPanelProps = {
	onBack: () => void;
};

export function ReleaseNotesPanel({ onBack }: ReleaseNotesPanelProps) {
	const t = useT();
	const state = useReleaseNotes(true);

	return (
		<>
			<div className="shrink-0 border-b border-border bg-background px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
				<div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
					<h3 className="text-sm font-medium text-foreground">
						{t("about.releaseNotes.title")}
					</h3>
					<div className="flex flex-wrap items-center justify-end gap-2">
						<Button type="button" variant="secondary" onClick={onBack}>
							<ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
							{t("about.releaseNotes.back")}
						</Button>
						<Button
							type="button"
							variant="secondary"
							onClick={() => rendererIpc.openGithubReleases()}
						>
							<ExternalLink className="mr-2 h-4 w-4" aria-hidden />
							{t("about.releaseNotes.viewOnGithub")}
						</Button>
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [overflow-anchor:none] [scrollbar-gutter:stable] px-4 py-4 sm:px-6 sm:py-5">
				<div className="mx-auto flex max-w-3xl flex-col gap-4">
					{state.status === "loading" || state.status === "idle" ? (
						<SettingPanel>
							<p className="text-sm text-muted-foreground">
								{t("about.releaseNotes.loading")}
							</p>
						</SettingPanel>
					) : null}

					{state.status === "error" ? (
						<SettingPanel>
							<p className="text-sm text-muted-foreground">
								{t("about.releaseNotes.error", { message: state.message })}
							</p>
						</SettingPanel>
					) : null}

					{state.status === "ok" && state.releases.length === 0 ? (
						<SettingPanel>
							<p className="text-sm text-muted-foreground">
								{t("about.releaseNotes.empty")}
							</p>
						</SettingPanel>
					) : null}

					{state.status === "ok"
						? state.releases.map((release) => (
								<SettingPanel key={release.tagName}>
									<SettingRow
										title={release.name}
										description={formatReleaseMeta(
											release.publishedAt,
											release.prerelease,
											t,
										)}
									>
										{release.body.trim() ? (
											<SimpleMarkdown
												source={release.body}
												className="select-text"
											/>
										) : (
											<p className="text-sm text-muted-foreground">
												{t("about.releaseNotes.emptyBody")}
											</p>
										)}
									</SettingRow>
								</SettingPanel>
							))
						: null}
				</div>
			</div>
		</>
	);
}

function formatReleaseMeta(
	publishedAt: string | null,
	prerelease: boolean,
	t: (key: string, vars?: Record<string, string | number>) => string,
): string {
	const parts: string[] = [];
	if (publishedAt) {
		const date = new Date(publishedAt);
		if (!Number.isNaN(date.getTime())) {
			parts.push(
				date.toLocaleDateString(undefined, {
					year: "numeric",
					month: "short",
					day: "numeric",
				}),
			);
		}
	}
	if (prerelease) {
		parts.push(t("about.releaseNotes.prerelease"));
	}
	return parts.join(" · ");
}
