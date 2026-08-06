import { Activity, Clock, Play, Square } from "lucide-react";
import { Button } from "@/components/button";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import { SettingPanel, SettingRow } from "@/features/settings/ui/setting-panel";

interface ReminderControlsProps {
	preferences: SettingsPreferences;
	onIntervalChange: (seconds: number) => void;
	onToggleTracking: () => void;
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
					<div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
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
						<div className="min-w-[4.5rem] rounded-md bg-accent px-3 py-1 text-center text-sm font-semibold text-accent-foreground">
							{preferences.reminderInterval}s
						</div>
					</div>
				</SettingRow>
			</SettingPanel>

			<div className="flex flex-col items-center gap-3 py-2">
				<Button
					type="button"
					size="lg"
					variant={preferences.isTracking ? "destructive" : "default"}
					onClick={onToggleTracking}
					className="gap-2 px-8"
				>
					{preferences.isTracking ? (
						<>
							<Square className="h-5 w-5" aria-hidden />
							Stop Reminders
						</>
					) : (
						<>
							<Play className="h-5 w-5" aria-hidden />
							Start Reminders
						</>
					)}
				</Button>
				{preferences.isTracking ? (
					<div className="flex items-center gap-2 text-sm font-medium text-primary">
						<Activity className="h-4 w-4" aria-hidden />
						<span>Reminders active</span>
					</div>
				) : null}
			</div>
		</>
	);
}
