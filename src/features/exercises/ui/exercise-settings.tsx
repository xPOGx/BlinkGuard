import { Clock, Dumbbell } from "lucide-react";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import {
	SettingPanel,
	SettingRow,
	ToggleSwitch,
} from "@/features/settings/ui/setting-panel";

interface ExerciseSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function ExerciseSettings({
	preferences,
	setPreferences,
}: ExerciseSettingsProps) {
	const progress = ((preferences.exerciseInterval - 5) / 55) * 100;
	const trackColor = preferences.darkMode
		? "hsl(217 25% 18%)"
		: "hsl(210 18% 90%)";
	const fillColor = "hsl(173 58% 36%)";

	return (
		<SettingPanel>
			<SettingRow
				title={
					<>
						<Dumbbell className="h-4 w-4 text-muted-foreground" aria-hidden />
						Eye Exercises
					</>
				}
				description={`Get prompted for eye exercises every ${preferences.exerciseInterval} minute${preferences.exerciseInterval !== 1 ? "s" : ""} to help reduce eye strain`}
				action={
					<ToggleSwitch
						aria-label="Toggle eye exercises"
						checked={preferences.eyeExercisesEnabled}
						onChange={() =>
							setPreferences((current) => ({
								...current,
								eyeExercisesEnabled: !current.eyeExercisesEnabled,
							}))
						}
					/>
				}
			>
				{preferences.eyeExercisesEnabled ? (
					<div className="space-y-3 border-t border-border pt-3">
						<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
							<Clock className="h-3 w-3" aria-hidden />
							Interval
						</div>
						<div className="flex items-center gap-2">
							<input
								aria-label="Exercise interval"
								type="range"
								min="5"
								max="60"
								value={preferences.exerciseInterval}
								onChange={(event) =>
									setPreferences((current) => ({
										...current,
										exerciseInterval: Number.parseInt(event.target.value, 10),
									}))
								}
								className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-muted"
								style={{
									background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${progress}%, ${trackColor} ${progress}%, ${trackColor} 100%)`,
								}}
							/>
							<div className="min-w-[2.5rem] text-center text-xs font-medium text-primary">
								{preferences.exerciseInterval}m
							</div>
						</div>
						<div className="rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
							Exercise reminders will appear periodically
						</div>
					</div>
				) : null}
			</SettingRow>
		</SettingPanel>
	);
}
