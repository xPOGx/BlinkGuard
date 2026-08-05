import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { Clock, Dumbbell } from "lucide-react";

interface ExerciseSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function ExerciseSettings({
	preferences,
	setPreferences,
}: ExerciseSettingsProps) {
	const progress = ((preferences.exerciseInterval - 5) / 55) * 100;
	const trackColor = preferences.darkMode ? "#1E3A8A" : "#E5E7EB";

	return (
		<div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 sm:p-6 overflow-hidden">
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<Dumbbell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
					<span className="font-medium text-gray-800 dark:text-white text-sm sm:text-base">
						Eye Exercises
					</span>
				</div>
				<button
					type="button"
					aria-label="Toggle eye exercises"
					onClick={() =>
						setPreferences((current) => ({
							...current,
							eyeExercisesEnabled: !current.eyeExercisesEnabled,
						}))
					}
					className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
						preferences.eyeExercisesEnabled
							? "bg-blue-600"
							: "bg-gray-300 dark:bg-gray-600"
					}`}
				>
					<span
						className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
							preferences.eyeExercisesEnabled
								? "translate-x-6"
								: "translate-x-1"
						}`}
					/>
				</button>
			</div>
			<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-3">
				Get prompted for eye exercises every {preferences.exerciseInterval}{" "}
				minute
				{preferences.exerciseInterval !== 1 ? "s" : ""} to help reduce eye
				strain
			</p>

			{preferences.eyeExercisesEnabled && (
				<>
					<div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
						<div className="flex items-center gap-2 mb-2">
							<Clock className="w-3 h-3 text-gray-500 dark:text-gray-400" />
							<span className="text-xs font-medium text-gray-600 dark:text-gray-300">
								Interval
							</span>
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
										exerciseInterval: Number.parseInt(event.target.value),
									}))
								}
								className="flex-1 h-1.5 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
								style={{
									background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${progress}%, ${trackColor} ${progress}%, ${trackColor} 100%)`,
								}}
							/>
							<div className="text-xs font-medium text-blue-600 dark:text-blue-400 min-w-[40px] text-center">
								{preferences.exerciseInterval}m
							</div>
						</div>
					</div>
					<div className="mt-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
						Exercise reminders will appear periodically
					</div>
				</>
			)}
		</div>
	);
}
