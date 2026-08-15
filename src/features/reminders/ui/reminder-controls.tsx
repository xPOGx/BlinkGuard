import { Activity, Clock, Moon, Play, Square } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/button";
import { RangeSlider } from "@/components/range-slider";
import { SettingPanel } from "@/components/setting-panel";
import { SettingRow } from "@/components/setting-row";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import { useI18n } from "@/i18n";
import { pluralKey } from "../../../../shared/i18n";

interface ReminderControlsProps {
	preferences: SettingsPreferences;
	setPreferences: Dispatch<SetStateAction<SettingsPreferences>>;
	onIntervalChange: (seconds: number) => void;
	onToggleTracking: () => void;
}

function formatBlinksPerMinute(intervalSeconds: number): string {
	const rate = 60 / intervalSeconds;
	return Number.isInteger(rate) ? String(rate) : rate.toFixed(1);
}

export function ReminderControls({
	preferences,
	setPreferences,
	onIntervalChange,
	onToggleTracking,
}: ReminderControlsProps) {
	const { t, locale } = useI18n();
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
	const snoozeMinutes = preferences.snoozeMinutes;
	const snoozeDescKey = pluralKey(
		"reminders.snoozeDesc",
		locale,
		snoozeMinutes,
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
						<RangeSlider
							id="reminder-interval"
							aria-label={t("reminders.intervalAria")}
							min={1}
							max={10}
							value={preferences.reminderInterval}
							onChange={onIntervalChange}
							className="sm:flex-1"
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

			<SettingPanel>
				<SettingRow
					title={
						<>
							<Moon className="h-4 w-4 text-muted-foreground" aria-hidden />
							<label htmlFor="snooze-minutes">{t("reminders.snooze")}</label>
						</>
					}
					description={t(snoozeDescKey, { n: snoozeMinutes })}
				>
					<div className="flex items-center gap-2">
						<RangeSlider
							id="snooze-minutes"
							aria-label={t("reminders.snoozeAria")}
							min={1}
							max={30}
							value={snoozeMinutes}
							onChange={(next) =>
								setPreferences((current) => ({
									...current,
									snoozeMinutes: next,
								}))
							}
							className="h-1.5 flex-1"
						/>
						<div className="min-w-[2.5rem] text-center text-xs font-medium text-primary">
							{snoozeMinutes}m
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
				<p className="mt-2 text-2xs opacity-80 sm:text-xs">
					{t("reminders.guidance.disclaimer")}
				</p>
			</aside>
		</>
	);
}
