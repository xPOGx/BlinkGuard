import type { SettingsPreferences } from "@/features/settings/model/preferences";
import { Activity, Clock, Play, Square } from "lucide-react";

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
	const trackColor = preferences.darkMode ? "#1E3A8A" : "#E5E7EB";

	return (
		<>
			<div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 sm:p-6 overflow-hidden">
				<label
					htmlFor="reminder-interval"
					className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2"
				>
					<Clock className="w-4 h-4" />
					Reminder Interval
				</label>
				<div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
					<input
						id="reminder-interval"
						aria-label="Reminder interval"
						type="range"
						min="1"
						max="10"
						value={preferences.reminderInterval}
						onChange={(event) =>
							onIntervalChange(Number.parseInt(event.target.value))
						}
						className="w-full sm:flex-1 h-2 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
						style={{
							background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${progress}%, ${trackColor} ${progress}%, ${trackColor} 100%)`,
						}}
					/>
					<div className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full font-semibold min-w-[80px] text-center">
						{preferences.reminderInterval}s
					</div>
				</div>
				<p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2">
					{preferences.cameraEnabled
						? `Show reminder if you haven't blinked for ${preferences.reminderInterval} second${preferences.reminderInterval !== 1 ? "s" : ""}`
						: `Show reminder every ${preferences.reminderInterval} second${preferences.reminderInterval !== 1 ? "s" : ""}`}
				</p>
			</div>

			<div className="text-center">
				<button
					type="button"
					onClick={onToggleTracking}
					className={`inline-flex items-center gap-2 sm:gap-3 px-6 sm:px-8 py-3 sm:py-4 rounded-xl text-base sm:text-lg font-semibold transition-all duration-200 transform hover:scale-105 active:scale-95 ${
						preferences.isTracking
							? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200 dark:shadow-red-900/30"
							: "bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-200 dark:shadow-green-900/30"
					}`}
				>
					{preferences.isTracking ? (
						<>
							<Square className="w-5 h-5 sm:w-6 sm:h-6" />
							Stop Reminders
						</>
					) : (
						<>
							<Play className="w-5 h-5 sm:w-6 sm:h-6" />
							Start Reminders
						</>
					)}
				</button>
				{preferences.isTracking && (
					<div className="mt-4 flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
						<Activity className="w-4 h-4" />
						<span className="text-sm font-medium">Reminders active</span>
					</div>
				)}
			</div>
		</>
	);
}
