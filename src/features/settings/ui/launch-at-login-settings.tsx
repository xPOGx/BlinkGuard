import { LogIn } from "lucide-react";
import { SettingPanel } from "@/components/setting-panel";
import { SettingRow } from "@/components/setting-row";
import { ToggleSwitch } from "@/components/toggle-switch";
import { useT } from "@/i18n";
import type { SettingsPreferences } from "../model/preferences";
import type { SetPreferences } from "../model/use-preferences";

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
