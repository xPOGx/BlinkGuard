import { Clock, Dumbbell, Plus, RotateCcw, Trash2 } from "lucide-react";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import {
	SettingPanel,
	SettingRow,
	ToggleSwitch,
} from "@/features/settings/ui/setting-panel";
import { DEFAULT_EXERCISE_PROMPTS } from "../../../../shared/preferences";

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
	const prompts = preferences.exercisePrompts;

	const updatePrompt = (index: number, value: string) => {
		setPreferences((current) => {
			const next = [...current.exercisePrompts];
			next[index] = value;
			return { ...current, exercisePrompts: next };
		});
	};

	const addPrompt = () => {
		setPreferences((current) => ({
			...current,
			exercisePrompts: [...current.exercisePrompts, "New exercise"],
		}));
	};

	const removePrompt = (index: number) => {
		setPreferences((current) => {
			if (current.exercisePrompts.length <= 1) return current;
			return {
				...current,
				exercisePrompts: current.exercisePrompts.filter((_, i) => i !== index),
			};
		});
	};

	const resetPrompts = () => {
		setPreferences((current) => ({
			...current,
			exercisePrompts: [...DEFAULT_EXERCISE_PROMPTS],
		}));
	};

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

						<div className="space-y-2 border-t border-border pt-3">
							<div className="flex items-center justify-between gap-2">
								<div className="text-xs font-medium text-muted-foreground">
									Exercise prompts
								</div>
								<button
									type="button"
									onClick={resetPrompts}
									className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
								>
									<RotateCcw className="h-3 w-3" aria-hidden />
									Reset defaults
								</button>
							</div>
							<div className="space-y-2">
								{prompts.map((prompt, index) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: editable prefs rows use index as identity
									<div key={index} className="flex items-start gap-2">
										<textarea
											aria-label={`Exercise prompt ${index + 1}`}
											value={prompt}
											rows={2}
											onChange={(event) =>
												updatePrompt(index, event.target.value)
											}
											className="min-h-[2.5rem] flex-1 resize-y rounded-md border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
										/>
										<button
											type="button"
											aria-label={`Remove exercise prompt ${index + 1}`}
											disabled={prompts.length <= 1}
											onClick={() => removePrompt(index)}
											className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
										>
											<Trash2 className="h-3.5 w-3.5" aria-hidden />
										</button>
									</div>
								))}
							</div>
							<button
								type="button"
								onClick={addPrompt}
								className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
							>
								<Plus className="h-3 w-3" aria-hidden />
								Add prompt
							</button>
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
