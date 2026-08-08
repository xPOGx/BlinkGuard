import {
	BarChart3,
	Bug,
	Camera,
	Dumbbell,
	Info,
	Keyboard,
	Palette,
	ShoppingBag,
	Timer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { dismissBootSplash } from "@/boot-splash";
import { useAutoUpdate } from "@/features/about/model/use-auto-update";
import { AboutPanel } from "@/features/about/ui/about-panel";
import { UpdateDialog } from "@/features/about/ui/update-dialog";
import { useCameraStatus } from "@/features/camera/model/use-camera-status";
import {
	CameraControls,
	CameraErrorBanner,
} from "@/features/camera/ui/camera-controls";
import { DebugPanel } from "@/features/debug/ui/debug-panel";
import { ExerciseSettings } from "@/features/exercises/ui/exercise-settings";
import { EyePromptsDisabledNotice } from "@/features/exercises/ui/eye-prompts-disabled-notice";
import { LookAwaySettings } from "@/features/look-away/ui/look-away-settings";
import { OnboardingWizard } from "@/features/onboarding/ui/onboarding-wizard";
import { PopupSettings } from "@/features/popup-appearance/ui/popup-settings";
import { ReminderControls } from "@/features/reminders/ui/reminder-controls";
import { RewardsShopPanel } from "@/features/rewards/ui/rewards-shop-panel";
import { usePreferences } from "@/features/settings/model/use-preferences";
import {
	BackupSettings,
	DarkModeToggle,
	GoalsSettings,
	LanguageSettings,
	LaunchAtLoginSettings,
	QuietHoursFocusSettings,
	ResetPreferencesButton,
	SoundSettings,
} from "@/features/settings/ui/settings-controls";
import { TrackingEyeButton } from "@/features/settings/ui/tracking-eye-button";
import { useShortcutControls } from "@/features/shortcuts/model/use-shortcut-controls";
import { ShortcutSettings } from "@/features/shortcuts/ui/shortcut-settings";
import { StatisticsPanel } from "@/features/statistics/ui/statistics-panel";
import { I18nProvider, useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";

type SectionId =
	| "reminders"
	| "camera"
	| "exercises"
	| "appearance"
	| "statistics"
	| "rewards"
	| "system"
	| "about"
	| "debug";

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

	return (
		<I18nProvider locale={preferences.locale}>
			<SettingsShell
				preferences={preferences}
				setPreferences={setPreferences}
				prefsHydrated={prefsHydrated}
				toggleTracking={toggleTracking}
				changeReminderInterval={changeReminderInterval}
				camera={camera}
				shortcuts={shortcuts}
			/>
		</I18nProvider>
	);
}

function SettingsShell({
	preferences,
	setPreferences,
	prefsHydrated,
	toggleTracking,
	changeReminderInterval,
	camera,
	shortcuts,
}: {
	preferences: ReturnType<typeof usePreferences>["preferences"];
	setPreferences: ReturnType<typeof usePreferences>["setPreferences"];
	prefsHydrated: boolean;
	toggleTracking: () => void;
	changeReminderInterval: (seconds: number) => void;
	camera: ReturnType<typeof useCameraStatus>;
	shortcuts: ReturnType<typeof useShortcutControls>;
}) {
	const t = useT();
	const autoUpdate = useAutoUpdate();
	const [section, setSection] = useState<SectionId>("reminders");
	const sections: {
		id: SectionId;
		label: string;
		description: string;
		icon: typeof Timer;
	}[] = [
		{
			id: "reminders",
			label: t("app.section.reminders"),
			description: t("app.section.reminders.desc"),
			icon: Timer,
		},
		{
			id: "camera",
			label: t("app.section.camera"),
			description: t("app.section.camera.desc"),
			icon: Camera,
		},
		{
			id: "exercises",
			label: t("app.section.exercises"),
			description: t("app.section.exercises.desc"),
			icon: Dumbbell,
		},
		{
			id: "appearance",
			label: t("app.section.appearance"),
			description: t("app.section.appearance.desc"),
			icon: Palette,
		},
		{
			id: "statistics",
			label: t("app.section.statistics"),
			description: t("app.section.statistics.desc"),
			icon: BarChart3,
		},
		{
			id: "rewards",
			label: t("app.section.rewards"),
			description: t("app.section.rewards.desc"),
			icon: ShoppingBag,
		},
		{
			id: "system",
			label: t("app.section.system"),
			description: t("app.section.system.desc"),
			icon: Keyboard,
		},
		{
			id: "about",
			label: t("app.section.about"),
			description: t("app.section.about.desc"),
			icon: Info,
		},
		// Debug must always be the last nav section (DEV-only).
		...(import.meta.env.DEV
			? [
					{
						id: "debug" as const,
						label: t("app.section.debug"),
						description: t("app.section.debug.desc"),
						icon: Bug,
					},
				]
			: []),
	];
	const active = sections.find((item) => item.id === section) ?? sections[0];
	const showOnboarding = prefsHydrated && !preferences.hasCompletedOnboarding;

	useEffect(() => {
		if (!prefsHydrated) return;
		void (async () => {
			await dismissBootSplash();
			// Main DeferredTrackingRestore is one-shot; duplicates (Strict Mode) are fine.
			rendererIpc.notifyShellReady();
		})();
	}, [prefsHydrated]);

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground min-[721px]:flex-row">
			{showOnboarding ? (
				<OnboardingWizard
					preferences={preferences}
					setPreferences={setPreferences}
					shortcut={shortcuts}
				/>
			) : null}
			<UpdateDialog {...autoUpdate} />
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
							{t("app.tagline")}
						</p>
					</div>
				</div>

				<nav
					aria-label={t("app.navAria")}
					className="flex gap-1 overflow-x-auto px-3 pb-3 min-[721px]:flex-1 min-[721px]:flex-col min-[721px]:overflow-visible min-[721px]:px-3 min-[721px]:pb-0"
				>
					{sections.map((item) => {
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

				<main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [overflow-anchor:none] px-4 py-4 sm:px-6 sm:py-5">
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
								<EyePromptsDisabledNotice
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

						{section === "rewards" && <RewardsShopPanel />}

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
								<GoalsSettings
									preferences={preferences}
									setPreferences={setPreferences}
								/>
								<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
									<LanguageSettings
										preferences={preferences}
										setPreferences={setPreferences}
									/>
									<LaunchAtLoginSettings
										preferences={preferences}
										setPreferences={setPreferences}
									/>
									<ResetPreferencesButton />
								</div>
								<BackupSettings />
								<QuietHoursFocusSettings
									preferences={preferences}
									setPreferences={setPreferences}
								/>
							</>
						)}

						{section === "about" && <AboutPanel autoUpdate={autoUpdate} />}

						{section === "debug" && import.meta.env.DEV ? (
							<DebugPanel setPreferences={setPreferences} />
						) : null}
					</div>
				</main>
			</div>
		</div>
	);
}
