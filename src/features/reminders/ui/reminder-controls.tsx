import { Activity, Clock, Play, Square } from "lucide-react";
import { Button } from "@/components/button";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import { SettingPanel, SettingRow } from "@/features/settings/ui/setting-panel";

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
	const progress = ((preferences.reminderInterval - 1) / 9) * 100;
	const trackColor = preferences.darkMode
		? "hsl(217 25% 18%)"
		: "hsl(210 18% 90%)";
	const fillColor = "hsl(173 58% 36%)";
	const blinksPerMinute = 60 / preferences.reminderInterval;
	const formattedRate = formatBlinksPerMinute(preferences.reminderInterval);
	const inTypicalRange = blinksPerMinute >= 15 && blinksPerMinute <= 20;

	return (
		<>
			<SettingPanel>
				<SettingRow
					title={
						<>
							<Clock className="h-4 w-4 text-muted-foreground" aria-hidden />
							<label htmlFor="reminder-interval">Reminder Interval</label>
						</>
					}
					description={
						preferences.cameraEnabled
							? `Show reminder if you haven't blinked for ${preferences.reminderInterval} second${preferences.reminderInterval !== 1 ? "s" : ""}`
							: `Show reminder every ${preferences.reminderInterval} second${preferences.reminderInterval !== 1 ? "s" : ""}`
					}
				>
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
						<input
							id="reminder-interval"
							aria-label="Reminder interval"
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
							<div className="flex flex-col items-stretch gap-1">
								<Button
									type="button"
									size="default"
									variant={
										preferences.isTracking ? "destructive" : "default"
									}
									onClick={onToggleTracking}
									className="gap-2 whitespace-nowrap"
								>
									{preferences.isTracking ? (
										<>
											<Square className="h-4 w-4" aria-hidden />
											Stop
										</>
									) : (
										<>
											<Play className="h-4 w-4" aria-hidden />
											Start
										</>
									)}
								</Button>
								{preferences.isTracking ? (
									<div className="flex items-center justify-center gap-1 text-xs font-medium text-primary">
										<Activity className="h-3 w-3" aria-hidden />
										<span>Active</span>
									</div>
								) : null}
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
						~{formattedRate} blinks/min
					</span>
					{" — "}
					{preferences.cameraEnabled && !preferences.mgdMode
						? "upper bound if you blink once whenever a reminder would fire (reminders only appear after you have not blinked for the interval)."
						: "target cadence if you blink once per reminder interval."}
				</p>
				{inTypicalRange ? (
					<p className="mt-1.5 text-primary">
						Within the typical resting blink range (about 15–20/min).
					</p>
				) : null}
			</aside>

			<aside className="rounded-md bg-accent/60 p-3 text-xs text-muted-foreground sm:text-sm">
				<p className="mb-2 font-semibold text-foreground">
					Blink rate guidance
				</p>
				<ul className="list-disc space-y-1.5 pl-4">
					<li>
						Typical resting rate is about{" "}
						<span className="font-medium text-foreground">15–20 blinks/min</span>{" "}
						(every 3–4s). During focused screen work it often drops to about{" "}
						<span className="font-medium text-foreground">4–7/min</span>.
					</li>
					<li>
						Gender studies are mixed; when a difference is reported, women often
						average a bit higher (roughly{" "}
						<span className="font-medium text-foreground">15–20/min</span>) than
						men (roughly{" "}
						<span className="font-medium text-foreground">10–15/min</span>).
						Individual variation is large — use this as orientation, not a
						personal target.
					</li>
					<li>
						With MGD or dry eye, prefer{" "}
						<span className="font-medium text-foreground">complete</span> blinks
						(lids meet) at a regular ~15–20/min cadence; incomplete blinks during
						screen use matter as much as rate. Deliberate close–squeeze blink sets
						during long sessions can help. Enable Camera →{" "}
						<span className="font-medium text-foreground">MGD Mode</span> for
						fixed-interval reminders.
					</li>
				</ul>
				<p className="mt-2 text-[0.7rem] opacity-80 sm:text-xs">
					Educational only — not a diagnosis or medical advice.
				</p>
			</aside>
		</>
	);
}
