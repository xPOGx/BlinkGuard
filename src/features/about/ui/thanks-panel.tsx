import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/button";
import { SettingPanel } from "@/components/setting-panel";
import { THANKS_PEOPLE } from "@/features/about/model/thanks";
import { useT } from "@/i18n";

type ThanksPanelProps = {
	onBack: () => void;
};

export function ThanksPanel({ onBack }: ThanksPanelProps) {
	const t = useT();

	return (
		<>
			<div className="shrink-0 border-b border-border bg-background px-4 pt-4 pb-3 sm:px-6 sm:pt-5">
				<div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
					<h3 className="text-sm font-medium text-foreground">
						{t("about.thanks.title")}
					</h3>
					<Button type="button" variant="secondary" onClick={onBack}>
						<ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
						{t("about.thanks.back")}
					</Button>
				</div>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [overflow-anchor:none] px-4 py-4 sm:px-6 sm:py-5">
				<div className="mx-auto flex max-w-3xl flex-col gap-4">
					<SettingPanel>
						<p className="text-sm text-muted-foreground">
							{t("about.thanks.intro")}
						</p>
					</SettingPanel>

					<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						{THANKS_PEOPLE.map((person) => (
							<SettingPanel key={person.name}>
								<p className="text-sm font-medium text-foreground">
									{person.name}
								</p>
							</SettingPanel>
						))}
					</div>
				</div>
			</div>
		</>
	);
}
