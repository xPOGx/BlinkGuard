import { LogIn, Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/button";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type { SettingsPreferences } from "../model/preferences";
import type { SetPreferences } from "../model/use-preferences";
import { SettingPanel, SettingRow, ToggleSwitch } from "./setting-panel";

interface DarkModeToggleProps {
	darkMode: boolean;
	setPreferences: SetPreferences;
	variant?: "icon" | "row";
}

export function DarkModeToggle({
	darkMode,
	setPreferences,
	variant = "icon",
}: DarkModeToggleProps) {
	const toggle = () =>
		setPreferences((current) => ({
			...current,
			darkMode: !current.darkMode,
		}));

	if (variant === "row") {
		return (
			<button
				type="button"
				onClick={toggle}
				className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-muted"
				aria-label="Toggle dark mode"
			>
				<span className="flex items-center gap-2">
					{darkMode ? (
						<Sun className="h-4 w-4 text-amber-400" aria-hidden />
					) : (
						<Moon className="h-4 w-4" aria-hidden />
					)}
					{darkMode ? "Light mode" : "Dark mode"}
				</span>
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={toggle}
			className="rounded-md border border-border bg-card p-2 text-foreground transition-colors hover:bg-muted"
			aria-label="Toggle dark mode"
		>
			{darkMode ? (
				<Sun className="h-4 w-4 text-amber-400" aria-hidden />
			) : (
				<Moon className="h-4 w-4" aria-hidden />
			)}
		</button>
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
		<SettingPanel>
			<SettingRow
				title={
					<>
						{preferences.soundEnabled ? (
							<Volume2 className="h-4 w-4 text-muted-foreground" aria-hidden />
						) : (
							<VolumeX className="h-4 w-4 text-muted-foreground" aria-hidden />
						)}
						Notification Sound
					</>
				}
				description="Play sounds for blink reminders and exercise prompts"
				action={
					<ToggleSwitch
						aria-label="Toggle notification sound"
						checked={preferences.soundEnabled}
						onChange={() =>
							setPreferences((current) => ({
								...current,
								soundEnabled: !current.soundEnabled,
							}))
						}
					/>
				}
			/>
		</SettingPanel>
	);
}

interface LaunchAtLoginSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function LaunchAtLoginSettings({
	preferences,
	setPreferences,
}: LaunchAtLoginSettingsProps) {
	return (
		<SettingPanel>
			<SettingRow
				title={
					<>
						<LogIn className="h-4 w-4 text-muted-foreground" aria-hidden />
						Launch at login
					</>
				}
				description="Start BlinkGuard hidden in the system tray when you sign in"
				action={
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
				}
			/>
		</SettingPanel>
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
		<SettingPanel className="flex items-center justify-center">
			<Button type="button" variant="destructive" onClick={reset}>
				Reset Preferences
			</Button>
		</SettingPanel>
	);
}

export function GamingNotice() {
	return (
		<aside className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100">
			<h3 className="mb-1 text-sm font-semibold">Gaming notice</h3>
			<p className="text-sm opacity-90">
				If you use blink reminders while gaming, prefer{" "}
				<strong>Borderless Windowed</strong> or <strong>Windowed</strong> mode.
				Fullscreen games may be interrupted when popups appear.
			</p>
		</aside>
	);
}
