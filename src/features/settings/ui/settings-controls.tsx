import {
	Gamepad2,
	LogIn,
	Moon,
	Play,
	Sun,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import {
	SettingPanel,
	SettingRow,
	ToggleSwitch,
} from "@/components/setting-panel";
import { useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import {
	defaultExercisePrompts,
	defaultPopupMessage,
	isBuiltInExercisePrompts,
	isBuiltInPopupMessage,
	type Locale,
} from "../../../../shared/i18n";
import type { SettingsPreferences } from "../model/preferences";
import type { SetPreferences } from "../model/use-preferences";

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
	const t = useT();
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
				aria-label={t("common.toggleDarkMode")}
			>
				<span className="flex items-center gap-2">
					{darkMode ? (
						<Sun className="h-4 w-4 text-amber-400" aria-hidden />
					) : (
						<Moon className="h-4 w-4" aria-hidden />
					)}
					{darkMode ? t("common.lightMode") : t("common.darkMode")}
				</span>
			</button>
		);
	}

	return (
		<button
			type="button"
			onClick={toggle}
			className="rounded-md border border-border bg-card p-2 text-foreground transition-colors hover:bg-muted"
			aria-label={t("common.toggleDarkMode")}
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
	const t = useT();
	const volume = preferences.soundVolume;
	const volumeProgress = volume;
	const trackColor = preferences.darkMode
		? "hsl(217 25% 18%)"
		: "hsl(210 18% 90%)";
	const fillColor = "hsl(173 58% 36%)";
	const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
		};
	}, []);

	const previewBlinkAt = (nextVolume: number) => {
		if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
		previewTimerRef.current = setTimeout(() => {
			rendererIpc.debugPreviewSound("blink", nextVolume);
		}, 250);
	};

	const playTestNow = () => {
		if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
		rendererIpc.debugPreviewSound("blink", volume);
	};

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
						{t("sound.title")}
					</>
				}
				description={t("sound.description")}
				action={
					<ToggleSwitch
						aria-label={t("sound.toggleAria")}
						checked={preferences.soundEnabled}
						onChange={() =>
							setPreferences((current) => ({
								...current,
								soundEnabled: !current.soundEnabled,
							}))
						}
					/>
				}
			>
				{preferences.soundEnabled ? (
					<div className="flex items-center gap-3">
						<label
							htmlFor="sound-volume"
							className="shrink-0 text-sm text-muted-foreground"
						>
							{t("sound.volume")}
						</label>
						<input
							id="sound-volume"
							aria-label={t("sound.volumeAria")}
							type="range"
							min="0"
							max="100"
							value={volume}
							onChange={(event) => {
								const nextVolume = Number.parseInt(event.target.value, 10);
								setPreferences((current) => ({
									...current,
									soundVolume: nextVolume,
								}));
								previewBlinkAt(nextVolume);
							}}
							className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-muted"
							style={{
								background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${volumeProgress}%, ${trackColor} ${volumeProgress}%, ${trackColor} 100%)`,
							}}
						/>
						<div className="min-w-[3.25rem] rounded-md bg-accent px-2 py-1 text-center text-sm font-semibold text-accent-foreground">
							{volume}%
						</div>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="gap-1.5"
							aria-label={t("sound.testAria")}
							onClick={playTestNow}
						>
							<Play className="h-3.5 w-3.5" aria-hidden />
							{t("sound.test")}
						</Button>
					</div>
				) : null}
			</SettingRow>
		</SettingPanel>
	);
}

interface LanguageSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function LanguageSettings({
	preferences,
	setPreferences,
}: LanguageSettingsProps) {
	const t = useT();
	return (
		<SettingPanel>
			<SettingRow
				title={t("language.title")}
				description={t("language.description")}
				action={
					<select
						aria-label={t("language.toggleAria")}
						value={preferences.locale}
						onChange={(event) => {
							const locale = event.target.value as Locale;
							setPreferences((current) => {
								const next: SettingsPreferences = {
									...current,
									locale,
								};
								if (isBuiltInPopupMessage(current.popupMessage)) {
									next.popupMessage = defaultPopupMessage(locale);
								}
								if (isBuiltInExercisePrompts(current.exercisePrompts)) {
									next.exercisePrompts = defaultExercisePrompts(locale);
								}
								return next;
							});
						}}
						className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
					>
						<option value="en">{t("language.en")}</option>
						<option value="uk">{t("language.uk")}</option>
					</select>
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
	const t = useT();
	return (
		<SettingPanel>
			<SettingRow
				title={
					<>
						<LogIn className="h-4 w-4 text-muted-foreground" aria-hidden />
						{t("launch.title")}
					</>
				}
				description={t("launch.description")}
				action={
					<ToggleSwitch
						aria-label={t("launch.toggleAria")}
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
	const t = useT();
	const [confirming, setConfirming] = useState(false);
	const [replayOnboarding, setReplayOnboarding] = useState(false);

	const confirmReset = () => {
		rendererIpc.resetPreferences(replayOnboarding);
		setConfirming(false);
		setReplayOnboarding(false);
	};

	if (confirming) {
		return (
			<SettingPanel className="space-y-3">
				<p className="text-sm text-foreground">{t("reset.confirm")}</p>
				<label className="flex items-start gap-2 text-sm text-muted-foreground">
					<input
						type="checkbox"
						checked={replayOnboarding}
						onChange={(event) => setReplayOnboarding(event.target.checked)}
						className="mt-0.5"
					/>
					<span>{t("reset.replayOnboarding")}</span>
				</label>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="secondary"
						onClick={() => {
							setConfirming(false);
							setReplayOnboarding(false);
						}}
					>
						{t("common.cancel")}
					</Button>
					<Button type="button" variant="destructive" onClick={confirmReset}>
						{t("common.reset")}
					</Button>
				</div>
			</SettingPanel>
		);
	}

	return (
		<SettingPanel className="flex items-center justify-center">
			<Button
				type="button"
				variant="destructive"
				onClick={() => setConfirming(true)}
			>
				{t("reset.title")}
			</Button>
		</SettingPanel>
	);
}

interface QuietHoursFocusSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function QuietHoursFocusSettings({
	preferences,
	setPreferences,
}: QuietHoursFocusSettingsProps) {
	const t = useT();
	const [pauseReason, setPauseReason] = useState<
		"quiet-hours" | "fullscreen" | null
	>(null);
	const [fullscreenDetectionSupported, setFullscreenDetectionSupported] =
		useState<boolean | null>(null);

	useEffect(
		() =>
			rendererIpc.onFocusPauseState((payload) => {
				setPauseReason(payload.reason);
				setFullscreenDetectionSupported(payload.fullscreenDetectionSupported);
			}),
		[],
	);

	const statusLabel =
		pauseReason === "quiet-hours"
			? t("quietHours.paused")
			: pauseReason === "fullscreen"
				? t("fullscreen.paused")
				: null;

	const fullscreenUnsupported = fullscreenDetectionSupported === false;

	return (
		<SettingPanel className="space-y-4">
			<SettingRow
				title={
					<>
						<Moon className="h-4 w-4 text-muted-foreground" aria-hidden />
						{t("quietHours.title")}
					</>
				}
				description={t("quietHours.description")}
				action={
					<ToggleSwitch
						aria-label={t("quietHours.toggleAria")}
						checked={preferences.quietHoursEnabled}
						onChange={() =>
							setPreferences((current) => ({
								...current,
								quietHoursEnabled: !current.quietHoursEnabled,
							}))
						}
					/>
				}
			>
				{preferences.quietHoursEnabled ? (
					<div className="flex flex-wrap items-center gap-3">
						<label className="flex items-center gap-2 text-sm text-muted-foreground">
							<span>{t("common.from")}</span>
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
							<span>{t("common.to")}</span>
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
			</SettingRow>

			<SettingRow
				title={
					<>
						<Gamepad2 className="h-4 w-4 text-muted-foreground" aria-hidden />
						{t("fullscreen.title")}
					</>
				}
				description={
					fullscreenUnsupported
						? t("fullscreen.unsupportedDescription")
						: t("fullscreen.description")
				}
				action={
					<ToggleSwitch
						aria-label={t("fullscreen.toggleAria")}
						checked={preferences.pauseOnFullscreen}
						disabled={fullscreenUnsupported}
						onChange={() =>
							setPreferences((current) => ({
								...current,
								pauseOnFullscreen: !current.pauseOnFullscreen,
							}))
						}
					/>
				}
			/>

			{statusLabel ? (
				<p
					className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100"
					role="status"
				>
					{statusLabel}
				</p>
			) : null}
		</SettingPanel>
	);
}
