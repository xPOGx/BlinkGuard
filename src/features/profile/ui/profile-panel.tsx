import { Share } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/components/setting-panel";
import { useProfile } from "@/features/profile/model/use-profile";
import { renderProfileShareCard } from "@/features/profile/ui/profile-share-card";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";

function SummaryStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-border bg-background px-3 py-2">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
		</div>
	);
}

export function ProfilePanel() {
	const { t, locale } = useI18n();
	const {
		snapshot,
		progress,
		titleKey,
		descKey,
		tierKey,
		titleMaxed,
		milestones,
	} = useProfile();
	const [shareBusy, setShareBusy] = useState(false);
	const [shareStatus, setShareStatus] = useState<string | null>(null);

	const handleShare = async () => {
		if (shareBusy) return;
		setShareBusy(true);
		setShareStatus(t("profile.share.busy"));
		try {
			const dark = document.documentElement.classList.contains("dark");
			const dateLabel = new Intl.DateTimeFormat(
				locale === "uk" ? "uk-UA" : "en-US",
				{ dateStyle: "medium" },
			).format(new Date());
			const png = await renderProfileShareCard({
				brand: t("profile.share.card.brand"),
				levelLabel: t("profile.share.card.level", {
					level: progress.level,
				}),
				title: t(titleKey),
				tier: t(tierKey),
				blinksLabel: t("profile.share.card.blinks", {
					n: snapshot.totals.total,
				}),
				streakLabel: t("profile.share.card.streak", {
					n: snapshot.streak.current,
				}),
				dateLabel,
				dark,
			});
			const result = await rendererIpc.exportProfileImage(png);
			if (result.status === "cancelled") {
				setShareStatus(t("profile.share.cancelled"));
			} else if (result.status === "saved") {
				setShareStatus(t("profile.share.saved", { path: result.path ?? "" }));
			} else {
				setShareStatus(
					t("profile.share.error", {
						message: result.message ?? "unknown",
					}),
				);
			}
		} catch (error) {
			setShareStatus(
				t("profile.share.error", {
					message: error instanceof Error ? error.message : String(error),
				}),
			);
		} finally {
			setShareBusy(false);
		}
	};

	return (
		<>
			<SettingPanel>
				<SettingRow
					title={t("profile.hero.title")}
					description={t("profile.hero.desc")}
				>
					<div className="space-y-4">
						<div className="flex flex-wrap items-center gap-2.5">
							<p className="text-4xl font-semibold leading-none tabular-nums tracking-tight">
								{t("profile.levelLabel", { level: progress.level })}
							</p>
							<div className="flex flex-wrap items-center gap-2">
								<span className="inline-flex items-center rounded border border-teal-600/40 bg-teal-600/10 px-2 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wide text-teal-700 dark:text-teal-300">
									{t(tierKey)}
								</span>
								{snapshot.hasStatsFlair ? (
									<span className="inline-flex items-center rounded border border-teal-600/40 bg-teal-600/10 px-2 py-0.5 text-[11px] font-semibold uppercase leading-none tracking-wide text-teal-700 dark:text-teal-300">
										{t("stats.flair.badge")}
									</span>
								) : null}
							</div>
						</div>
						<div>
							<p className="text-lg font-medium">{t(titleKey)}</p>
							<p className="mt-1 text-sm text-muted-foreground">{t(descKey)}</p>
						</div>
						<div>
							<div className="mb-1.5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
								<span>
									{t("profile.progress", {
										current: progress.current,
										needed: progress.needed,
									})}
								</span>
								<span className="tabular-nums">
									{Math.round(progress.ratio * 100)}%
								</span>
							</div>
							{titleMaxed ? (
								<p className="mb-1.5 text-xs text-muted-foreground">
									{t("profile.progressMaxTitle")}
								</p>
							) : null}
							<div className="h-2 overflow-hidden rounded-full bg-muted">
								<div
									className="h-full rounded-full bg-primary transition-[width]"
									style={{ width: `${Math.min(100, progress.ratio * 100)}%` }}
								/>
							</div>
						</div>
					</div>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("profile.snapshot.title")}
					description={t("profile.snapshot.desc")}
				>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<SummaryStat
							label={t("profile.stat.today")}
							value={String(snapshot.today.blinks)}
						/>
						<SummaryStat
							label={t("profile.stat.lifetime")}
							value={String(snapshot.totals.total)}
						/>
						<SummaryStat
							label={t("profile.stat.streak")}
							value={String(snapshot.streak.current)}
						/>
						<SummaryStat
							label={t("profile.stat.available")}
							value={String(snapshot.totals.available)}
						/>
					</div>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("profile.milestones.title")}
					description={t("profile.milestones.desc")}
				>
					{milestones.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							{t("profile.milestones.empty")}
						</p>
					) : (
						<ul className="space-y-2">
							{milestones.map((item) => (
								<li
									key={item.level}
									className={cn(
										"flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2",
									)}
								>
									<div className="min-w-0">
										<p className="text-sm font-medium">
											{t("profile.levelLabel", { level: item.level })}
											<span className="text-muted-foreground">
												{" · "}
												{t(item.titleKey)}
											</span>
										</p>
									</div>
									<p className="shrink-0 text-xs tabular-nums text-muted-foreground">
										{t("profile.milestones.threshold", {
											n: item.threshold,
										})}
									</p>
								</li>
							))}
						</ul>
					)}
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("profile.share.title")}
					description={t("profile.share.desc")}
					action={
						<Button
							type="button"
							variant="secondary"
							disabled={shareBusy}
							onClick={() => void handleShare()}
						>
							<Share className="mr-2 h-4 w-4" />
							{t("profile.share.button")}
						</Button>
					}
				>
					{shareStatus ? (
						<p className="select-text break-all text-sm text-muted-foreground">
							{shareStatus}
						</p>
					) : null}
				</SettingRow>
			</SettingPanel>
		</>
	);
}
