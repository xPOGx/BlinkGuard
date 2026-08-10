import { Link2Off } from "lucide-react";
import { SettingPanel } from "@/components/setting-panel";
import { SettingRow } from "@/components/setting-row";
import { ToggleSwitch } from "@/components/toggle-switch";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { useI18n } from "@/i18n";

interface EyeCareIndependenceSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function EyeCareIndependenceSettings({
	preferences,
	setPreferences,
}: EyeCareIndependenceSettingsProps) {
	const { t } = useI18n();

	return (
		<SettingPanel>
			<SettingRow
				title={
					<>
						<Link2Off className="h-4 w-4 text-muted-foreground" aria-hidden />
						{t("exercises.independent.title")}
					</>
				}
				description={t("exercises.independent.desc")}
				action={
					<ToggleSwitch
						aria-label={t("exercises.independent.toggleAria")}
						checked={preferences.eyeCareIndependentOfTracking}
						onChange={() =>
							setPreferences((current) => ({
								...current,
								eyeCareIndependentOfTracking:
									!current.eyeCareIndependentOfTracking,
							}))
						}
					/>
				}
			/>
		</SettingPanel>
	);
}
