import { Clock, Eye } from "lucide-react";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import {
	SettingPanel,
	SettingRow,
	ToggleSwitch,
} from "@/features/settings/ui/setting-panel";
import { useT } from "@/i18n";

interface LookAwaySettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function LookAwaySettings({
	preferences,
	setPreferences,
}: LookAwaySettingsProps) {
	const t = useT();
	const intervalProgress = ((preferences.lookAwayInterval - 5) / 55) * 100;
	const durationProgress = ((preferences.lookAwayDuration - 10) / 50) * 100;
	const trackColor = preferences.darkMode
		? "hsl(217 25% 18%)"
		: "hsl(210 18% 90%)";
	const fillColor = "hsl(173 58% 36%)";
	const intervalPlural = preferences.lookAwayInterval !== 1;
	const durationPlural = preferences.lookAwayDuration !== 1;
	const descKey =
		intervalPlural && durationPlural
			? "lookAway.desc_both_plural"
			: intervalPlural
				? "lookAway.desc_interval_plural"
				: durationPlural
					? "lookAway.desc_duration_plural"
					: "lookAway.desc";

	return (
		<SettingPanel>
			<SettingRow
				title={
					<>
						<Eye className="h-4 w-4 text-muted-foreground" aria-hidden />
						{t("lookAway.title")}
					</>
				}
				description={t(descKey, {
					interval: preferences.lookAwayInterval,
					duration: preferences.lookAwayDuration,
				})}
				action={
					<ToggleSwitch
						aria-label={t("lookAway.toggleAria")}
						checked={preferences.lookAwayEnabled}
						onChange={() =>
							setPreferences((current) => ({
								...current,
								lookAwayEnabled: !current.lookAwayEnabled,
							}))
						}
					/>
				}
			>
				{preferences.lookAwayEnabled ? (
					<div className="space-y-3 border-t border-border pt-3">
						<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<Clock className="h-3 w-3" aria-hidden />
							{t("common.interval")}
						</div>
						<div className="flex items-center gap-2">
							<input
								aria-label={t("lookAway.intervalAria")}
								type="range"
								min="5"
								max="60"
								value={preferences.lookAwayInterval}
								onChange={(event) =>
									setPreferences((current) => ({
										...current,
										lookAwayInterval: Number.parseInt(event.target.value, 10),
									}))
								}
								className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-muted"
								style={{
									background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${intervalProgress}%, ${trackColor} ${intervalProgress}%, ${trackColor} 100%)`,
								}}
							/>
							<div className="min-w-[2.5rem] text-center text-xs font-medium text-primary">
								{preferences.lookAwayInterval}m
							</div>
						</div>
						<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
							{t("common.duration")}
						</div>
						<div className="flex items-center gap-2">
							<input
								aria-label={t("lookAway.durationAria")}
								type="range"
								min="10"
								max="60"
								value={preferences.lookAwayDuration}
								onChange={(event) =>
									setPreferences((current) => ({
										...current,
										lookAwayDuration: Number.parseInt(event.target.value, 10),
									}))
								}
								className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-muted"
								style={{
									background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${durationProgress}%, ${trackColor} ${durationProgress}%, ${trackColor} 100%)`,
								}}
							/>
							<div className="min-w-[2.5rem] text-center text-xs font-medium text-primary">
								{preferences.lookAwayDuration}s
							</div>
						</div>
						<div className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
							{t("lookAway.hint")}
						</div>
					</div>
				) : null}
			</SettingRow>
		</SettingPanel>
	);
}
