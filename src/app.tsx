import {
	BarChart3,
	Bug,
	Camera,
	Dumbbell,
	Info,
	Palette,
	Settings,
	Timer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { dismissBootSplash } from "@/boot-splash";
import { SectionTabs } from "@/components/section-tabs";
import { useAutoUpdate } from "@/features/about/model/use-auto-update";
import { AboutPanel } from "@/features/about/ui/about-panel";
import { UpdateDialog } from "@/features/about/ui/update-dialog";
import { UpdateToast } from "@/features/about/ui/update-toast";
import { useCameraStatus } from "@/features/camera/model/use-camera-status";
import { CameraControls } from "@/features/camera/ui/camera-controls";
import { CameraErrorBanner } from "@/features/camera/ui/camera-error-banner";
import { DebugPanel } from "@/features/debug/ui/debug-panel";
import { ExerciseSettings } from "@/features/exercises/ui/exercise-settings";
import { EyeCareIndependenceSettings } from "@/features/exercises/ui/eye-care-independence-settings";
import { EyePromptsDisabledNotice } from "@/features/exercises/ui/eye-prompts-disabled-notice";
import { LookAwaySettings } from "@/features/look-away/ui/look-away-settings";
import { OnboardingWizard } from "@/features/onboarding/ui/onboarding-wizard";
import { PopupSettings } from "@/features/popup-appearance/ui/popup-settings";
import { ProfilePanel } from "@/features/profile/ui/profile-panel";
import { ReminderControls } from "@/features/reminders/ui/reminder-controls";
import { RewardsShopPanel } from "@/features/rewards/ui/rewards-shop-panel";
import { usePreferences } from "@/features/settings/model/use-preferences";
import { BackupSettings } from "@/features/settings/ui/backup-settings";
import { DarkModeToggle } from "@/features/settings/ui/dark-mode-toggle";
import { GoalsSettings } from "@/features/settings/ui/goals-settings";
import { LanguageSettings } from "@/features/settings/ui/language-settings";
import { LaunchAtLoginSettings } from "@/features/settings/ui/launch-at-login-settings";
import { QuietHoursFocusSettings } from "@/features/settings/ui/quiet-hours-focus-settings";
import { ResetPreferencesButton } from "@/features/settings/ui/reset-preferences-button";
import { SoundSettings } from "@/features/settings/ui/sound-settings";
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
	| "progress"
	| "settings"
	| "about"
	| "debug";

type ProgressTabId = "statistics" | "profile" | "rewards";

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
	const [progressTab, setProgressTab] = useState<ProgressTabId>("statistics");
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
			id: "progress",
			label: t("app.section.progress"),
			description: t("app.section.progress.desc"),
			icon: BarChart3,
		},
		{
			id: "settings",
			label: t("app.section.settings"),
			description: t("app.section.settings.desc"),
			icon: Settings,
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
	const progressTabs = [
		{ id: "statistics" as const, label: t("app.progress.tab.statistics") },
		{ id: "profile" as const, label: t("app.progress.tab.profile") },
		{ id: "rewards" as const, label: t("app.progress.tab.rewards") },
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
		<div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground min-[820px]:flex-row">
			{showOnboarding ? (
				<OnboardingWizard
					preferences={preferences}
					setPreferences={setPreferences}
					shortcut={shortcuts}
				/>
			) : null}
			<UpdateToast {...autoUpdate} />
			<UpdateDialog {...autoUpdate} />
			<aside className="flex shrink-0 flex-col border-b border-border bg-sidebar min-[820px]:w-56 min-[820px]:border-r min-[820px]:border-b-0">
				<div className="flex items-center gap-2.5 px-4 py-3 min-[820px]:px-5 min-[820px]:py-5">
					<TrackingEyeButton
						isTracking={preferences.isTracking}
						onToggle={toggleTracking}
					/>
					<div className="min-w-0">
						<h1 className="text-base font-semibold tracking-tight">
							BlinkGuard
						</h1>
						<p className="hidden text-xs text-muted-foreground min-[820px]:block">
							{t("app.tagline")}
						</p>
					</div>
				</div>

				<nav
					aria-label={t("app.navAria")}
					className="flex gap-1 overflow-x-auto px-3 pb-3 min-[820px]:flex-1 min-[820px]:flex-col min-[820px]:overflow-visible min-[820px]:px-3 min-[820px]:pb-0"
				>
					{sections.map((item) => {
						const Icon = item.icon;
						const selected = item.id === section;
						const showAttention =
							item.id === "camera" &&
							Boolean(camera.error) &&
							section !== "camera";
						return (
							<button
								key={item.id}
								type="button"
								aria-current={selected ? "page" : undefined}
								onClick={() => setSection(item.id)}
								className={cn(
									"relative inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
									selected
										? "bg-sidebar-active text-primary"
										: "text-sidebar-foreground hover:bg-muted",
								)}
							>
								<Icon className="h-4 w-4 shrink-0" aria-hidden />
								{item.label}
								{showAttention ? (
									<span
										className="ml-auto h-2 w-2 shrink-0 rounded-full bg-destructive"
										aria-label={t("app.navNeedsAttention")}
									/>
								) : null}
							</button>
						);
					})}
				</nav>

				<div className="hidden border-t border-border p-3 min-[820px]:block">
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
					<div className="shrink-0 min-[820px]:hidden">
						<DarkModeToggle
							darkMode={preferences.darkMode}
							setPreferences={setPreferences}
						/>
					</div>
				</header>

				<main className="flex min-h-0 flex-1 flex-col overflow-hidden">
					{section === "progress" ? (
						<>
							<div className="shrink-0 border-b border-border bg-background px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
								<div className="mx-auto max-w-4xl">
									<SectionTabs
										aria-label={t("app.progress.tabsAria")}
										items={progressTabs}
										value={progressTab}
										onChange={setProgressTab}
									/>
								</div>
							</div>
							<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [overflow-anchor:none] px-4 py-4 sm:px-6 sm:py-5">
								<div className="mx-auto flex max-w-4xl flex-col gap-4">
									{progressTab === "statistics" && (
										<>
											<GoalsSettings
												preferences={preferences}
												setPreferences={setPreferences}
											/>
											<StatisticsPanel />
										</>
									)}
									{progressTab === "profile" && <ProfilePanel />}
									{progressTab === "rewards" && <RewardsShopPanel />}
								</div>
							</div>
						</>
					) : section === "about" ? (
						<AboutPanel autoUpdate={autoUpdate} />
					) : (
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [overflow-anchor:none] px-4 py-4 sm:px-6 sm:py-5">
							<div className="mx-auto flex max-w-3xl flex-col gap-4">
								{section === "reminders" && (
									<>
										<ReminderControls
											preferences={preferences}
											setPreferences={setPreferences}
											onIntervalChange={changeReminderInterval}
											onToggleTracking={toggleTracking}
										/>
										<QuietHoursFocusSettings
											preferences={preferences}
											setPreferences={setPreferences}
										/>
									</>
								)}

								{section === "camera" && (
									<>
										<CameraErrorBanner
											error={camera.error}
											onDismiss={() => camera.setError(null)}
										/>
										<CameraControls
											preferences={preferences}
											setPreferences={setPreferences}
											isWindowOpen={camera.isWindowOpen}
											setIsWindowOpen={camera.setIsWindowOpen}
										/>
									</>
								)}

								{section === "exercises" && (
									<>
										<EyePromptsDisabledNotice
											eyeExercisesEnabled={preferences.eyeExercisesEnabled}
											lookAwayEnabled={preferences.lookAwayEnabled}
										/>
										<EyeCareIndependenceSettings
											preferences={preferences}
											setPreferences={setPreferences}
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

								{section === "settings" && (
									<>
										<ShortcutSettings
											shortcuts={preferences.keyboardShortcuts}
											activeAction={shortcuts.activeAction}
											temporaryShortcut={shortcuts.temporaryShortcut}
											errorMessage={shortcuts.errorMessage}
											onStartRecording={shortcuts.startRecording}
											onSave={shortcuts.save}
											onCancel={shortcuts.cancel}
											onClear={shortcuts.clear}
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
										</div>
										<BackupSettings />
										<ResetPreferencesButton />
									</>
								)}

								{section === "debug" && import.meta.env.DEV ? (
									<DebugPanel setPreferences={setPreferences} />
								) : null}
							</div>
						</div>
					)}
				</main>
			</div>
		</div>
	);
}
