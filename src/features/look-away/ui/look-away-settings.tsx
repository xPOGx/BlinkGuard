import { Clock, Eye, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/button";
import {
	SettingPanel,
	SettingRow,
	ToggleSwitch,
} from "@/components/setting-panel";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { useI18n } from "@/i18n";
import {
	defaultLookAwayHint,
	defaultLookAwayTitle,
} from "../../../../shared/i18n";

interface LookAwaySettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function LookAwaySettings({
	preferences,
	setPreferences,
}: LookAwaySettingsProps) {
	const { t } = useI18n();
	const [promptOpen, setPromptOpen] = useState(false);
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

	const resetPrompt = () => {
		setPreferences((current) => ({
			...current,
			lookAwayTitle: defaultLookAwayTitle(current.locale),
			lookAwayHint: defaultLookAwayHint(current.locale),
		}));
	};

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

						<div className="flex items-center justify-between gap-2 border-t border-border pt-3">
							<div className="text-xs font-medium text-muted-foreground">
								{t("lookAway.prompt")}
							</div>
							<Button
								type="button"
								size="sm"
								variant="secondary"
								aria-expanded={promptOpen}
								onClick={() => setPromptOpen((open) => !open)}
							>
								<span className="inline-grid grid-cols-1 grid-rows-1 place-items-center">
									<span
										className="invisible col-start-1 row-start-1 whitespace-nowrap"
										aria-hidden
									>
										{t("lookAway.showPrompt")}
									</span>
									<span
										className="invisible col-start-1 row-start-1 whitespace-nowrap"
										aria-hidden
									>
										{t("lookAway.hidePrompt")}
									</span>
									<span className="col-start-1 row-start-1 whitespace-nowrap">
										{promptOpen
											? t("lookAway.hidePrompt")
											: t("lookAway.showPrompt")}
									</span>
								</span>
							</Button>
						</div>

						{promptOpen ? (
							<div className="space-y-2">
								<div className="flex justify-end">
									<button
										type="button"
										onClick={resetPrompt}
										className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
									>
										<RotateCcw className="h-3 w-3" aria-hidden />
										{t("lookAway.resetDefaults")}
									</button>
								</div>
								<label className="block space-y-1">
									<span className="text-xs text-muted-foreground">
										{t("lookAway.promptTitle")}
									</span>
									<input
										aria-label={t("lookAway.promptTitleAria")}
										type="text"
										value={preferences.lookAwayTitle}
										onChange={(event) =>
											setPreferences((current) => ({
												...current,
												lookAwayTitle: event.target.value,
											}))
										}
										className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
									/>
								</label>
								<label className="block space-y-1">
									<span className="text-xs text-muted-foreground">
										{t("lookAway.promptHint")}
									</span>
									<textarea
										aria-label={t("lookAway.promptHintAria")}
										value={preferences.lookAwayHint}
										rows={2}
										onChange={(event) =>
											setPreferences((current) => ({
												...current,
												lookAwayHint: event.target.value,
											}))
										}
										className="min-h-[2.5rem] w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
									/>
								</label>
							</div>
						) : null}

						<div className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
							{t("lookAway.hint")}
						</div>
					</div>
				) : null}
			</SettingRow>
		</SettingPanel>
	);
}
