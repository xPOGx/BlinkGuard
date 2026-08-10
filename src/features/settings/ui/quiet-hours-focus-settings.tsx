import { Gamepad2, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { SettingPanel } from "@/components/setting-panel";
import { SettingRow } from "@/components/setting-row";
import { ToggleSwitch } from "@/components/toggle-switch";
import { useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type { SettingsPreferences } from "../model/preferences";
import type { SetPreferences } from "../model/use-preferences";

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
