import { ChevronDown } from "lucide-react";
import { SettingPanel } from "@/components/setting-panel";
import { SettingRow } from "@/components/setting-row";
import { useT } from "@/i18n";
import { isNotificationStyleValue } from "../../../../shared/notification-style";
import type { SettingsPreferences } from "../model/preferences";
import type { SetPreferences } from "../model/use-preferences";

interface NotificationStyleSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function NotificationStyleSettings({
	preferences,
	setPreferences,
}: NotificationStyleSettingsProps) {
	const t = useT();
	return (
		<SettingPanel>
			<SettingRow
				title={t("notifications.style.title")}
				description={t("notifications.style.description")}
				action={
					<div className="relative">
						<select
							aria-label={t("notifications.style.aria")}
							value={preferences.notificationStyle}
							onChange={(event) => {
								const notificationStyle = event.target.value;
								if (!isNotificationStyleValue(notificationStyle)) {
									return;
								}
								setPreferences((current) => ({
									...current,
									notificationStyle,
								}));
							}}
							className="appearance-none rounded-md border border-border bg-background py-1.5 pl-2.5 pr-9 text-sm text-foreground"
						>
							<option value="overlay">
								{t("notifications.style.overlay")}
							</option>
							<option value="native">{t("notifications.style.native")}</option>
							<option value="both">{t("notifications.style.both")}</option>
						</select>
						<ChevronDown
							className="pointer-events-none absolute top-1/2 right-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
							aria-hidden
						/>
					</div>
				}
			/>
		</SettingPanel>
	);
}
