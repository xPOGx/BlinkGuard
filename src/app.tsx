import {
	BarChart3,
	Camera,
	Dumbbell,
	Keyboard,
	Palette,
	Timer,
} from "lucide-react";
import { useState } from "react";
import { useCameraStatus } from "@/features/camera/model/use-camera-status";
import {
	CameraControls,
	CameraErrorBanner,
} from "@/features/camera/ui/camera-controls";
import { ExerciseSettings } from "@/features/exercises/ui/exercise-settings";
import { EyeCareDisabledNotice } from "@/features/exercises/ui/eye-care-disabled-notice";
import { LookAwaySettings } from "@/features/look-away/ui/look-away-settings";
import { OnboardingWizard } from "@/features/onboarding/ui/onboarding-wizard";
import { PopupSettings } from "@/features/popup-appearance/ui/popup-settings";
import { ReminderControls } from "@/features/reminders/ui/reminder-controls";
import { usePreferences } from "@/features/settings/model/use-preferences";
import {
	DarkModeToggle,
	LaunchAtLoginSettings,
	QuietHoursFocusSettings,
	ResetPreferencesButton,
	ShowOnboardingButton,
	SoundSettings,
} from "@/features/settings/ui/settings-controls";
import { TrackingEyeButton } from "@/features/settings/ui/tracking-eye-button";
import { useShortcutControls } from "@/features/shortcuts/model/use-shortcut-controls";
import { ShortcutSettings } from "@/features/shortcuts/ui/shortcut-settings";
import { StatisticsPanel } from "@/features/statistics/ui/statistics-panel";
import { cn } from "@/lib/utils";

type SectionId =
	| "reminders"
	| "camera"
	| "exercises"
	| "appearance"
	| "statistics"
	| "system";

const SECTIONS: {
	id: SectionId;
	label: string;
	description: string;
	icon: typeof Timer;
}[] = [
	{
		id: "reminders",
		label: "Reminders",
		description: "Interval and start/stop controls for blink reminders.",
		icon: Timer,
	},
	{
		id: "camera",
		label: "Camera",
		description: "Detection, quality, calibration, and MGD mode.",
		icon: Camera,
	},
	{
		id: "exercises",
		label: "Eye care",
		description: "Exercises and 20-20-20 look-away breaks.",
		icon: Dumbbell,
	},
	{
		id: "appearance",
		label: "Appearance",
		description: "Popup message, colors, size, and notification sound.",
		icon: Palette,
	},
	{
		id: "statistics",
		label: "Statistics",
		description: "Local blink counts, tracking time, and day/week charts.",
		icon: BarChart3,
	},
	{
		id: "system",
		label: "System",
		description: "Shortcut, launch at login, and reset.",
		icon: Keyboard,
	},
];

export default function BlinkGuardHomepage() {
	const {
		preferences,
		setPreferences,
		prefsHydrated,
		toggleTracking,
		changeReminderInterval,
	} = usePreferences();
	const camera = useCameraStatus();
	const shortcuts = useShortcutControls({
		preferences,
		setPreferences,
		toggleTracking,
	});
	const [section, setSection] = useState<SectionId>("reminders");
	const active = SECTIONS.find((item) => item.id === section) ?? SECTIONS[0];
	const showOnboarding = prefsHydrated && !preferences.hasCompletedOnboarding;

	return (
		<div className="flex h-screen flex-col bg-background text-foreground min-[721px]:flex-row">
			{showOnboarding ? (
				<OnboardingWizard
					preferences={preferences}
					setPreferences={setPreferences}
					shortcut={shortcuts}
				/>
			) : null}
			<aside className="flex shrink-0 flex-col border-b border-border bg-sidebar min-[721px]:w-56 min-[721px]:border-r min-[721px]:border-b-0">
				<div className="flex items-center gap-2.5 px-4 py-3 min-[721px]:px-5 min-[721px]:py-5">
					<TrackingEyeButton
						isTracking={preferences.isTracking}
						onToggle={toggleTracking}
					/>
					<div className="min-w-0">
						<h1 className="text-base font-semibold tracking-tight">
							BlinkGuard
						</h1>
						<p className="hidden text-xs text-muted-foreground min-[721px]:block">
							Eye care settings
						</p>
					</div>
				</div>

				<nav
					aria-label="Settings sections"
					className="flex gap-1 overflow-x-auto px-3 pb-3 min-[721px]:flex-1 min-[721px]:flex-col min-[721px]:overflow-visible min-[721px]:px-3 min-[721px]:pb-0"
				>
					{SECTIONS.map((item) => {
						const Icon = item.icon;
						const selected = item.id === section;
						return (
							<button
								key={item.id}
								type="button"
								aria-current={selected ? "page" : undefined}
								onClick={() => setSection(item.id)}
								className={cn(
									"inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
									selected
										? "bg-sidebar-active text-primary"
										: "text-sidebar-foreground hover:bg-muted",
								)}
							>
								<Icon className="h-4 w-4 shrink-0" aria-hidden />
								{item.label}
							</button>
						);
					})}
				</nav>

				<div className="hidden border-t border-border p-3 min-[721px]:block">
					<DarkModeToggle
						darkMode={preferences.darkMode}
						setPreferences={setPreferences}
						variant="row"
					/>
				</div>
			</aside>

			<div className="flex min-h-0 min-w-0 flex-1 flex-col">
				<header className="flex items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
					<div className="min-w-0">
						<h2 className="text-lg font-semibold tracking-tight sm:text-xl">
							{active.label}
						</h2>
						<p className="mt-0.5 text-sm text-muted-foreground">
							{active.description}
						</p>
					</div>
					<div className="shrink-0 min-[721px]:hidden">
						<DarkModeToggle
							darkMode={preferences.darkMode}
							setPreferences={setPreferences}
						/>
					</div>
				</header>

				<CameraErrorBanner
					error={camera.error}
					onDismiss={() => camera.setError(null)}
				/>

				<main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
					<div className="mx-auto flex max-w-3xl flex-col gap-4">
						{section === "reminders" && (
							<ReminderControls
								preferences={preferences}
								onIntervalChange={changeReminderInterval}
								onToggleTracking={toggleTracking}
							/>
						)}

						{section === "camera" && (
							<CameraControls
								preferences={preferences}
								setPreferences={setPreferences}
								isWindowOpen={camera.isWindowOpen}
								setIsWindowOpen={camera.setIsWindowOpen}
							/>
						)}

						{section === "exercises" && (
							<>
								<EyeCareDisabledNotice
									eyeExercisesEnabled={preferences.eyeExercisesEnabled}
									lookAwayEnabled={preferences.lookAwayEnabled}
								/>
								<ExerciseSettings
									preferences={preferences}
									setPreferences={setPreferences}
								/>
								<LookAwaySettings
									preferences={preferences}
									setPreferences={setPreferences}
								/>
							</>
						)}

						{section === "appearance" && (
							<>
								<PopupSettings
									preferences={preferences}
									setPreferences={setPreferences}
								/>
								<SoundSettings
									preferences={preferences}
									setPreferences={setPreferences}
								/>
							</>
						)}

						{section === "statistics" && <StatisticsPanel />}

						{section === "system" && (
							<>
								<ShortcutSettings
									shortcut={preferences.keyboardShortcut}
									isRecording={shortcuts.isRecording}
									temporaryShortcut={shortcuts.temporaryShortcut}
									error={shortcuts.error}
									onStartRecording={shortcuts.startRecording}
									onSave={shortcuts.save}
									onCancel={shortcuts.cancel}
								/>
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<LaunchAtLoginSettings
										preferences={preferences}
										setPreferences={setPreferences}
									/>
									<ResetPreferencesButton />
									{import.meta.env.DEV ? (
										<ShowOnboardingButton setPreferences={setPreferences} />
									) : null}
								</div>
								<QuietHoursFocusSettings
									preferences={preferences}
									setPreferences={setPreferences}
								/>
							</>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
