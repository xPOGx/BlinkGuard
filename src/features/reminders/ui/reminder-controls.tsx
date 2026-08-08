import { Activity, Clock, Play, Square } from "lucide-react";
import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/components/setting-panel";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import { useI18n } from "@/i18n";
import { pluralKey } from "../../../../shared/i18n";

interface ReminderControlsProps {
	preferences: SettingsPreferences;
	onIntervalChange: (seconds: number) => void;
	onToggleTracking: () => void;
}

function formatBlinksPerMinute(intervalSeconds: number): string {
	const rate = 60 / intervalSeconds;
	return Number.isInteger(rate) ? String(rate) : rate.toFixed(1);
}

export function ReminderControls({
	preferences,
	onIntervalChange,
	onToggleTracking,
}: ReminderControlsProps) {
	const { t, locale } = useI18n();
	const progress = ((preferences.reminderInterval - 1) / 9) * 100;
	const trackColor = preferences.darkMode
		? "hsl(217 25% 18%)"
		: "hsl(210 18% 90%)";
	const fillColor = "hsl(173 58% 36%)";
	const blinksPerMinute = 60 / preferences.reminderInterval;
	const formattedRate = formatBlinksPerMinute(preferences.reminderInterval);
	const inTypicalRange = blinksPerMinute >= 15 && blinksPerMinute <= 20;
	const interval = preferences.reminderInterval;
	const descKey = pluralKey(
		preferences.cameraEnabled
			? "reminders.desc.camera"
			: "reminders.desc.timer",
		locale,
		interval,
	);
	return (
		<>
			<SettingPanel>
				<SettingRow
					title={
						<>
							<Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
							<label htmlFor="reminder-interval">
								{t("reminders.interval")}
							</label>
						</>
					}
					description={t(descKey, { n: interval })}
				>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
						<input
							id="reminder-interval"
							aria-label={t("reminders.intervalAria")}
							type="range"
							min="1"
							max="10"
							value={preferences.reminderInterval}
							onChange={(event) =>
								onIntervalChange(Number.parseInt(event.target.value, 10))
							}
							className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted sm:flex-1"
							style={{
								background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${progress}%, ${trackColor} ${progress}%, ${trackColor} 100%)`,
							}}
						/>
						<div className="flex shrink-0 items-center justify-center gap-3 sm:justify-end">
							<div className="min-w-[4.5rem] rounded-md bg-accent px-3 py-1 text-center text-sm font-semibold text-accent-foreground">
								{preferences.reminderInterval}s
							</div>
							<div className="relative">
								{preferences.isTracking ? (
									<div className="absolute bottom-full left-0 right-0 mb-1 flex items-center justify-center gap-1 text-xs font-medium text-primary">
										<Activity className="h-3 w-3" aria-hidden />
										<span>{t("common.active")}</span>
									</div>
								) : null}
								<Button
									type="button"
									size="default"
									variant={preferences.isTracking ? "destructive" : "default"}
									onClick={onToggleTracking}
									className="w-[5.75rem] gap-2 whitespace-nowrap"
								>
									{preferences.isTracking ? (
										<>
											<Square className="h-4 w-4" aria-hidden />
											{t("common.stop")}
										</>
									) : (
										<>
											<Play className="h-4 w-4" aria-hidden />
											{t("common.start")}
										</>
									)}
								</Button>
							</div>
						</div>
					</div>
				</SettingRow>
			</SettingPanel>

			<aside
				role="status"
				className="rounded-md bg-accent/60 p-3 text-xs text-muted-foreground sm:text-sm"
			>
				<p>
					<span className="font-semibold text-foreground">
						{t("reminders.rateSummary", { rate: formattedRate })}
					</span>
					{" — "}
					{preferences.cameraEnabled && !preferences.mgdMode
						? t("reminders.rateHint.camera")
						: t("reminders.rateHint.timer")}
				</p>
				{inTypicalRange ? (
					<p className="mt-1.5 text-primary">{t("reminders.inTypicalRange")}</p>
				) : null}
			</aside>

			<aside className="rounded-md bg-accent/60 p-3 text-xs text-muted-foreground sm:text-sm">
				<p className="mb-2 font-semibold text-foreground">
					{t("reminders.guidanceTitle")}
				</p>
				<ul className="list-disc space-y-1.5 pl-4">
					<li>
						{t("reminders.guidance.1", {
							resting: t("reminders.guidance.1.resting"),
							focused: t("reminders.guidance.1.focused"),
						})}
					</li>
					<li>
						{t("reminders.guidance.2", {
							women: t("reminders.guidance.2.women"),
							men: t("reminders.guidance.2.men"),
						})}
					</li>
					<li>
						{t("reminders.guidance.3.before")}
						<span className="font-medium text-foreground">
							{t("reminders.guidance.3.complete")}
						</span>
						{t("reminders.guidance.3.after")}
						<span className="font-medium text-foreground">
							{t("reminders.guidance.3.mgd")}
						</span>
						{t("reminders.guidance.3.afterMgd")}
					</li>
				</ul>
				<p className="mt-2 text-[0.7rem] opacity-80 sm:text-xs">
					{t("reminders.guidance.disclaimer")}
				</p>
			</aside>
		</>
	);
}
