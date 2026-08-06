import { useCameraStatus } from "@/features/camera/model/use-camera-status";
import {
	CameraControls,
	CameraErrorBanner,
} from "@/features/camera/ui/camera-controls";
import { ExerciseSettings } from "@/features/exercises/ui/exercise-settings";
import { PopupSettings } from "@/features/popup-appearance/ui/popup-settings";
import { ReminderControls } from "@/features/reminders/ui/reminder-controls";
import { usePreferences } from "@/features/settings/model/use-preferences";
import {
	ResetPreferencesButton,
	SettingsHeader,
	SoundSettings,
} from "@/features/settings/ui/settings-controls";
import { useShortcutControls } from "@/features/shortcuts/model/use-shortcut-controls";
import { ShortcutSettings } from "@/features/shortcuts/ui/shortcut-settings";
import { Eye } from "lucide-react";
import { useEffect } from "react";

export default function BlinkGuardHomepage() {
	const {
		preferences,
		setPreferences,
		toggleTracking,
		changeReminderInterval,
	} = usePreferences();
	const camera = useCameraStatus();
	const shortcuts = useShortcutControls({
		preferences,
		setPreferences,
		toggleTracking,
	});

	useEffect(() => {
		const style = document.createElement("style");
		style.textContent = `
			@keyframes fadeOut {
				from { opacity: 1; transform: translateY(0); }
				to { opacity: 0; transform: translateY(-20px); }
			}
			.animate-fade-out { animation: fadeOut 1s ease-out forwards; }
		`;
		document.head.appendChild(style);
		return () => style.remove();
	}, []);

	return (
		<div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4 sm:p-6">
			<div className="max-w-4xl mx-auto">
				<header className="text-center mb-6 sm:mb-8">
					<div className="flex justify-center items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
						<Eye className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600 dark:text-blue-400" />
						<h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white">
							BlinkGuard
						</h1>
					</div>
					<p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 px-4">
						Keep your eyes healthy with smart blink reminders
					</p>
				</header>

				<CameraErrorBanner
					error={camera.error}
					onDismiss={() => camera.setError(null)}
				/>

				<main className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 mb-6 overflow-hidden">
					<div className="grid lg:grid-cols-2 gap-6 lg:gap-8 min-w-0">
						<section className="space-y-6 min-w-0">
							<SettingsHeader
								darkMode={preferences.darkMode}
								setPreferences={setPreferences}
							/>
							<ReminderControls
								preferences={preferences}
								onIntervalChange={changeReminderInterval}
								onToggleTracking={toggleTracking}
							/>
							<CameraControls
								preferences={preferences}
								setPreferences={setPreferences}
								isWindowOpen={camera.isWindowOpen}
								setIsWindowOpen={camera.setIsWindowOpen}
							/>
						</section>

						<section className="space-y-6 min-w-0">
							<h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-white">
								Preferences
							</h2>
							<ExerciseSettings
								preferences={preferences}
								setPreferences={setPreferences}
							/>
							<ShortcutSettings
								shortcut={preferences.keyboardShortcut}
								isRecording={shortcuts.isRecording}
								temporaryShortcut={shortcuts.temporaryShortcut}
								error={shortcuts.error}
								onStartRecording={shortcuts.startRecording}
								onSave={shortcuts.save}
								onCancel={shortcuts.cancel}
							/>
							<PopupSettings
								preferences={preferences}
								setPreferences={setPreferences}
							/>
							<SoundSettings
								preferences={preferences}
								setPreferences={setPreferences}
							/>
						</section>
					</div>
				</main>

				<ResetPreferencesButton />

				<aside className="mt-6 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
					<h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
						🎮 Gaming Notice
					</h3>
					<p className="text-sm text-amber-700 dark:text-amber-200">
						<strong>Important:</strong> If you plan to use blink reminders while
						playing video games, please use <strong>Borderless Windowed</strong>{" "}
						or <strong>Windowed</strong> mode instead of Fullscreen. Fullscreen
						games may be interrupted when popups appear, causing you to exit the
						game unexpectedly.
					</p>
				</aside>
			</div>
		</div>
	);
}
