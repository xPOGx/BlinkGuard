import { SettingPanel } from "@/components/setting-panel";
import { THANKS_PEOPLE } from "@/features/about/model/thanks";
import { useT } from "@/i18n";

export function ThanksPanel() {
	const t = useT();

	return (
		<>
			<SettingPanel>
				<p className="text-sm text-muted-foreground">
					{t("about.thanks.intro")}
				</p>
			</SettingPanel>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				{THANKS_PEOPLE.map((person) => (
					<SettingPanel key={person.name}>
						<p className="text-sm font-medium text-foreground">{person.name}</p>
					</SettingPanel>
				))}
			</div>
		</>
	);
}
