import { Camera, Keyboard, LogIn, Moon, Timer } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/button";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import {
	SettingPanel,
	ToggleSwitch,
} from "@/features/settings/ui/setting-panel";
import { ShortcutSettings } from "@/features/shortcuts/ui/shortcut-settings";
import { cn } from "@/lib/utils";

const STEPS = [
	{ id: "mode", title: "Reminder mode", label: "Mode" },
	{ id: "shortcut", title: "Keyboard shortcut", label: "Shortcut" },
	{ id: "launch", title: "Launch at login", label: "Launch" },
	{ id: "quiet", title: "Quiet hours", label: "Quiet hours" },
] as const;

interface OnboardingWizardProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
	shortcut: {
		isRecording: boolean;
		temporaryShortcut: string;
		error: string;
		startRecording: () => void;
		save: () => void;
		cancel: () => void;
	};
}

export function OnboardingWizard({
	preferences,
	setPreferences,
	shortcut,
}: OnboardingWizardProps) {
	const [stepIndex, setStepIndex] = useState(0);
	const isLast = stepIndex === STEPS.length - 1;
	const step = STEPS[stepIndex];

	const complete = () => {
		setPreferences((current) => ({
			...current,
			hasCompletedOnboarding: true,
		}));
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			aria-labelledby="onboarding-title"
		>
			<SettingPanel className="flex w-full max-w-lg flex-col gap-5 shadow-lg">
				<div className="space-y-1">
					<p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Welcome to BlinkGuard
					</p>
					<h2
						id="onboarding-title"
						className="text-xl font-semibold tracking-tight"
					>
						{step.title}
					</h2>
					<p className="text-sm text-muted-foreground">
						A quick setup — you can change everything later in Settings.
					</p>
				</div>

				<div className="flex items-center gap-2">
					{STEPS.map((item, index) => (
						<span
							key={item.id}
							className={cn(
								"h-1.5 flex-1 rounded-full transition-colors",
								index <= stepIndex ? "bg-primary" : "bg-muted",
							)}
							aria-hidden
						/>
					))}
				</div>

				<div className="min-h-40">
					{step.id === "mode" ? (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<button
								type="button"
								onClick={() =>
									setPreferences((current) => ({
										...current,
										cameraEnabled: false,
									}))
								}
								className={cn(
									"rounded-lg border p-4 text-left transition-colors",
									!preferences.cameraEnabled
										? "border-primary bg-primary/10"
										: "border-border hover:bg-muted",
								)}
								aria-pressed={!preferences.cameraEnabled}
							>
								<Timer
									className="mb-2 h-5 w-5 text-muted-foreground"
									aria-hidden
								/>
								<p className="text-sm font-medium">Timer</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Reminders on a fixed interval. Works without a camera.
								</p>
							</button>
							<button
								type="button"
								onClick={() =>
									setPreferences((current) => ({
										...current,
										cameraEnabled: true,
									}))
								}
								className={cn(
									"rounded-lg border p-4 text-left transition-colors",
									preferences.cameraEnabled
										? "border-primary bg-primary/10"
										: "border-border hover:bg-muted",
								)}
								aria-pressed={preferences.cameraEnabled}
							>
								<Camera
									className="mb-2 h-5 w-5 text-muted-foreground"
									aria-hidden
								/>
								<p className="text-sm font-medium">Camera</p>
								<p className="mt-1 text-xs text-muted-foreground">
									Blink-aware reminders when you forget to blink (webcam
									required).
								</p>
							</button>
						</div>
					) : null}

					{step.id === "shortcut" ? (
						<div className="space-y-3">
							<p className="flex items-start gap-2 text-sm text-muted-foreground">
								<Keyboard className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
								Use this shortcut anytime to start or stop blink reminders.
							</p>
							<ShortcutSettings
								shortcut={preferences.keyboardShortcut}
								isRecording={shortcut.isRecording}
								temporaryShortcut={shortcut.temporaryShortcut}
								error={shortcut.error}
								onStartRecording={shortcut.startRecording}
								onSave={shortcut.save}
								onCancel={shortcut.cancel}
							/>
						</div>
					) : null}

					{step.id === "launch" ? (
						<div className="space-y-3">
							<div className="flex items-center justify-between gap-4">
								<p className="flex min-w-0 items-center gap-2 text-sm font-medium">
									<LogIn
										className="h-4 w-4 shrink-0 text-muted-foreground"
										aria-hidden
									/>
									Launch at login
								</p>
								<div className="shrink-0">
									<ToggleSwitch
										aria-label="Toggle launch at login"
										checked={preferences.launchAtLogin}
										onChange={() =>
											setPreferences((current) => ({
												...current,
												launchAtLogin: !current.launchAtLogin,
											}))
										}
									/>
								</div>
							</div>
							<p className="text-xs text-muted-foreground sm:text-sm">
								Start BlinkGuard hidden in the system tray when you sign in.
								Closing the window keeps the app running in the tray.
							</p>
						</div>
					) : null}

					{step.id === "quiet" ? (
						<div className="space-y-3">
							<div className="flex items-center justify-between gap-4">
								<p className="flex min-w-0 items-center gap-2 text-sm font-medium">
									<Moon
										className="h-4 w-4 shrink-0 text-muted-foreground"
										aria-hidden
									/>
									Quiet hours
								</p>
								<div className="shrink-0">
									<ToggleSwitch
										aria-label="Toggle quiet hours"
										checked={preferences.quietHoursEnabled}
										onChange={() =>
											setPreferences((current) => ({
												...current,
												quietHoursEnabled: !current.quietHoursEnabled,
											}))
										}
									/>
								</div>
							</div>
							<p className="text-xs text-muted-foreground sm:text-sm">
								Hide blink and eye-care popups during this local-time window.
							</p>
							{preferences.quietHoursEnabled ? (
								<div className="flex flex-wrap items-center gap-3">
									<label className="flex items-center gap-2 text-sm text-muted-foreground">
										<span>From</span>
										<input
											type="time"
											value={preferences.quietHoursStart}
											onChange={(event) =>
												setPreferences((current) => ({
													...current,
													quietHoursStart: event.target.value,
												}))
											}
											className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
										/>
									</label>
									<label className="flex items-center gap-2 text-sm text-muted-foreground">
										<span>To</span>
										<input
											type="time"
											value={preferences.quietHoursEnd}
											onChange={(event) =>
												setPreferences((current) => ({
													...current,
													quietHoursEnd: event.target.value,
												}))
											}
											className="rounded-md border border-border bg-background px-2 py-1 text-foreground"
										/>
									</label>
								</div>
							) : null}
						</div>
					) : null}
				</div>

				<div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
					<Button type="button" variant="ghost" onClick={complete}>
						Skip
					</Button>
					<div className="flex gap-2">
						{stepIndex > 0 ? (
							<Button
								type="button"
								variant="secondary"
								onClick={() => setStepIndex((current) => current - 1)}
							>
								Back
							</Button>
						) : null}
						{isLast ? (
							<Button type="button" onClick={complete}>
								Finish
							</Button>
						) : (
							<Button
								type="button"
								onClick={() => setStepIndex((current) => current + 1)}
							>
								Next
							</Button>
						)}
					</div>
				</div>
			</SettingPanel>
		</div>
	);
}
