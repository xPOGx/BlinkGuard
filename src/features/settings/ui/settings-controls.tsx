import {
	Download,
	Gamepad2,
	LogIn,
	Moon,
	Play,
	Sun,
	Upload,
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
import { cn } from "@/lib/utils";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type { BackupScope } from "../../../../shared/backup";
import {
	defaultExercisePrompts,
	defaultPopupMessage,
	isBuiltInExercisePrompts,
	isBuiltInPopupMessage,
	type Locale,
} from "../../../../shared/i18n";
import { DEFAULT_GOALS_CONFIG } from "../../../../shared/preferences";
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

const BACKUP_SCOPES: BackupScope[] = ["both", "preferences", "statistics"];

export function BackupSettings() {
	const t = useT();
	const [scope, setScope] = useState<BackupScope>("both");
	const [confirmingImport, setConfirmingImport] = useState(false);
	const [busy, setBusy] = useState<"export" | "import" | null>(null);
	const [status, setStatus] = useState<string | null>(null);

	const handleExport = async () => {
		if (busy) return;
		setBusy("export");
		setStatus(null);
		try {
			const result = await rendererIpc.exportBackup(scope);
			if (result.status === "cancelled") {
				setStatus(t("backup.export.cancelled"));
			} else if (result.status === "saved") {
				setStatus(t("backup.export.success", { path: result.path ?? "" }));
			} else {
				setStatus(
					t("backup.export.error", {
						message: result.message ?? "unknown",
					}),
				);
			}
		} catch (error) {
			setStatus(
				t("backup.export.error", {
					message: error instanceof Error ? error.message : String(error),
				}),
			);
		} finally {
			setBusy(null);
		}
	};

	const handleImport = async () => {
		if (busy) return;
		setBusy("import");
		setStatus(null);
		try {
			const result = await rendererIpc.importBackup(scope);
			if (result.status === "cancelled") {
				setStatus(t("backup.import.cancelled"));
			} else if (result.status === "imported") {
				setStatus(t("backup.import.success"));
			} else {
				setStatus(
					t("backup.import.error", {
						message: result.message ?? "unknown",
					}),
				);
			}
		} catch (error) {
			setStatus(
				t("backup.import.error", {
					message: error instanceof Error ? error.message : String(error),
				}),
			);
		} finally {
			setBusy(null);
			setConfirmingImport(false);
		}
	};

	if (confirmingImport) {
		return (
			<SettingPanel className="space-y-3">
				<p className="text-sm text-foreground">{t("backup.import.confirm")}</p>
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="secondary"
						disabled={busy !== null}
						onClick={() => setConfirmingImport(false)}
					>
						{t("common.cancel")}
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled={busy !== null}
						onClick={() => {
							void handleImport();
						}}
					>
						{busy === "import"
							? t("backup.import.busy")
							: t("backup.import.button")}
					</Button>
				</div>
			</SettingPanel>
		);
	}

	return (
		<SettingPanel>
			<SettingRow title={t("backup.title")} description={t("backup.body")}>
				<fieldset
					className="m-0 space-y-1.5 border-0 p-0 pt-1"
					disabled={busy !== null}
				>
					<legend className="mb-2 px-0 text-xs font-medium text-muted-foreground">
						{t("backup.scope.legend")}
					</legend>
					{BACKUP_SCOPES.map((value) => {
						const selected = scope === value;
						const label =
							value === "both"
								? t("backup.scope.both")
								: value === "preferences"
									? t("backup.scope.preferences")
									: t("backup.scope.statistics");
						return (
							<label
								key={value}
								className={cn(
									"flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
									selected
										? "border-primary bg-primary/10 text-foreground"
										: "border-border bg-background text-foreground hover:bg-muted",
									busy !== null && "cursor-not-allowed opacity-50",
								)}
							>
								{/* In-flow radio (not sr-only): avoids focus scroll jumping the whole window. */}
								<input
									type="radio"
									name="backup-scope"
									value={value}
									checked={selected}
									onChange={() => setScope(value)}
									disabled={busy !== null}
									className={cn(
										"h-4 w-4 shrink-0 appearance-none rounded-full border-2 bg-transparent",
										"checked:border-primary checked:bg-[radial-gradient(circle_at_center,hsl(var(--primary))_0_38%,transparent_40%)]",
										"focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
										selected ? "border-primary" : "border-muted-foreground/45",
									)}
								/>
								<span>{label}</span>
							</label>
						);
					})}
				</fieldset>
				<div className="mt-3 flex flex-wrap gap-2">
					<Button
						type="button"
						variant="secondary"
						disabled={busy !== null}
						onClick={() => {
							void handleExport();
						}}
					>
						<Upload className="mr-2 h-4 w-4" aria-hidden />
						{busy === "export"
							? t("backup.export.busy")
							: t("backup.export.button")}
					</Button>
					<Button
						type="button"
						variant="destructive"
						disabled={busy !== null}
						onClick={() => {
							setStatus(null);
							setConfirmingImport(true);
						}}
					>
						<Download className="mr-2 h-4 w-4" aria-hidden />
						{t("backup.import.button")}
					</Button>
				</div>
				{status ? (
					<p className="mt-3 select-text text-sm text-muted-foreground break-all">
						{status}
					</p>
				) : null}
			</SettingRow>
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

interface GoalsSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

function GoalNumberInput({
	id,
	label,
	value,
	onChange,
}: {
	id: string;
	label: string;
	value: number;
	onChange: (value: number) => void;
}) {
	return (
		<label className="flex flex-col gap-1 text-sm">
			<span className="text-muted-foreground">{label}</span>
			<input
				id={id}
				type="number"
				min={0}
				max={100000}
				value={value}
				onChange={(event) => {
					const next = Number.parseInt(event.target.value, 10);
					onChange(Number.isFinite(next) ? Math.max(0, next) : 0);
				}}
				className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-foreground tabular-nums"
			/>
		</label>
	);
}

export function GoalsSettings({
	preferences,
	setPreferences,
}: GoalsSettingsProps) {
	const t = useT();
	const atDefaults =
		preferences.goalsEnabled === DEFAULT_GOALS_CONFIG.goalsEnabled &&
		preferences.dailyBlinkGoal === DEFAULT_GOALS_CONFIG.dailyBlinkGoal &&
		preferences.dailyTrackingMinutesGoal ===
			DEFAULT_GOALS_CONFIG.dailyTrackingMinutesGoal &&
		preferences.weeklyBlinkGoal === DEFAULT_GOALS_CONFIG.weeklyBlinkGoal &&
		preferences.weeklyTrackingMinutesGoal ===
			DEFAULT_GOALS_CONFIG.weeklyTrackingMinutesGoal;

	const resetGoals = () =>
		setPreferences((current) => ({
			...current,
			...DEFAULT_GOALS_CONFIG,
		}));

	return (
		<SettingPanel>
			<SettingRow
				title={t("goals.title")}
				description={t("goals.description")}
				action={
					<ToggleSwitch
						aria-label={t("goals.enabledAria")}
						checked={preferences.goalsEnabled}
						onChange={() =>
							setPreferences((current) => ({
								...current,
								goalsEnabled: !current.goalsEnabled,
							}))
						}
					/>
				}
			>
				{preferences.goalsEnabled ? (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<GoalNumberInput
							id="daily-blink-goal"
							label={t("goals.dailyBlinks")}
							value={preferences.dailyBlinkGoal}
							onChange={(dailyBlinkGoal) =>
								setPreferences((current) => ({
									...current,
									dailyBlinkGoal,
								}))
							}
						/>
						<GoalNumberInput
							id="daily-tracking-goal"
							label={t("goals.dailyTracking")}
							value={preferences.dailyTrackingMinutesGoal}
							onChange={(dailyTrackingMinutesGoal) =>
								setPreferences((current) => ({
									...current,
									dailyTrackingMinutesGoal,
								}))
							}
						/>
						<GoalNumberInput
							id="weekly-blink-goal"
							label={t("goals.weeklyBlinks")}
							value={preferences.weeklyBlinkGoal}
							onChange={(weeklyBlinkGoal) =>
								setPreferences((current) => ({
									...current,
									weeklyBlinkGoal,
								}))
							}
						/>
						<GoalNumberInput
							id="weekly-tracking-goal"
							label={t("goals.weeklyTracking")}
							value={preferences.weeklyTrackingMinutesGoal}
							onChange={(weeklyTrackingMinutesGoal) =>
								setPreferences((current) => ({
									...current,
									weeklyTrackingMinutesGoal,
								}))
							}
						/>
					</div>
				) : null}
				<div className={preferences.goalsEnabled ? "mt-3" : undefined}>
					<Button
						type="button"
						size="sm"
						variant="secondary"
						disabled={atDefaults}
						onClick={resetGoals}
					>
						{t("common.reset")}
					</Button>
				</div>
			</SettingRow>
		</SettingPanel>
	);
}
