import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { Moon, Settings, Sun, Volume2, VolumeX } from "lucide-react";
import type { SettingsPreferences } from "../model/preferences";
import type { SetPreferences } from "../model/use-preferences";

interface SettingsHeaderProps {
	darkMode: boolean;
	setPreferences: SetPreferences;
}

export function SettingsHeader({
	darkMode,
	setPreferences,
}: SettingsHeaderProps) {
	return (
		<div className="flex justify-between items-center">
			<h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
				<Settings className="w-5 h-5 sm:w-6 sm:h-6" />
				Control Panel
			</h2>
			<button
				type="button"
				onClick={() =>
					setPreferences((current) => ({
						...current,
						darkMode: !current.darkMode,
					}))
				}
				className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
				aria-label="Toggle dark mode"
			>
				{darkMode ? (
					<Sun className="w-5 h-5 text-yellow-500" />
				) : (
					<Moon className="w-5 h-5 text-gray-600" />
				)}
			</button>
		</div>
	);
}

interface SoundSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function SoundSettings({
	preferences,
	setPreferences,
}: SoundSettingsProps) {
	return (
		<div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 sm:p-6 overflow-hidden">
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					{preferences.soundEnabled ? (
						<Volume2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
					) : (
						<VolumeX className="w-5 h-5 text-gray-600 dark:text-gray-400" />
					)}
					<span className="font-medium text-gray-800 dark:text-white text-sm sm:text-base">
						Notification Sound
					</span>
				</div>
				<button
					type="button"
					aria-label="Toggle notification sound"
					onClick={() =>
						setPreferences((current) => ({
							...current,
							soundEnabled: !current.soundEnabled,
						}))
					}
					className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
						preferences.soundEnabled
							? "bg-blue-600"
							: "bg-gray-300 dark:bg-gray-600"
					}`}
				>
					<span
						className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
							preferences.soundEnabled ? "translate-x-6" : "translate-x-1"
						}`}
					/>
				</button>
			</div>
			<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
				Play sounds for blink reminders and exercise prompts
			</p>
		</div>
	);
}

export function ResetPreferencesButton() {
	const reset = () => {
		if (
			window.confirm(
				"Are you sure you want to reset all preferences to default values?",
			)
		) {
			rendererIpc.resetPreferences();
		}
	};

	return (
		<div className="flex justify-center items-center mt-4">
			<button
				type="button"
				onClick={reset}
				className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
			>
				Reset Preferences
			</button>
		</div>
	);
}
