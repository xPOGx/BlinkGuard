import { ChevronDown } from "lucide-react";
import { SettingPanel } from "@/components/setting-panel";
import { SettingRow } from "@/components/setting-row";
import { useT } from "@/i18n";
import type { Locale } from "../../../../shared/i18n";
import { applyLocale } from "../model/apply-locale";
import type { SettingsPreferences } from "../model/preferences";
import type { SetPreferences } from "../model/use-preferences";

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
					<div className="relative">
						<select
							aria-label={t("language.toggleAria")}
							value={preferences.locale}
							onChange={(event) => {
								const locale = event.target.value as Locale;
								setPreferences((current) => applyLocale(current, locale));
							}}
							className="appearance-none rounded-md border border-border bg-background py-1.5 pl-2.5 pr-9 text-sm text-foreground"
						>
							<option value="en">{t("language.en")}</option>
							<option value="uk">{t("language.uk")}</option>
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
