import { ExternalLink } from "lucide-react";
import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/components/setting-panel";
import { useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { author, version } from "../../../../package.json";

const AUTHOR_NAME = author.name;

export function AboutPanel() {
	const t = useT();

	return (
		<>
			<SettingPanel>
				<SettingRow
					title={t("about.what.title")}
					description={t("about.what.body")}
				/>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("about.why.title")}
					description={t("about.why.body")}
				/>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("about.privacy.title")}
					description={t("about.privacy.body")}
				/>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("about.opensource.title")}
					description={t("about.opensource.body")}
					action={
						<Button
							type="button"
							variant="secondary"
							onClick={() => rendererIpc.openGithubRepo()}
						>
							<ExternalLink className="mr-2 h-4 w-4" aria-hidden />
							{t("about.opensource.github")}
						</Button>
					}
				/>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title="BlinkGuard"
					action={
						<Button
							type="button"
							variant="secondary"
							onClick={() => rendererIpc.checkForUpdates()}
						>
							{t("about.checkForUpdates")}
						</Button>
					}
				>
					<p className="text-sm text-muted-foreground">
						{t("about.meta.version", { version })}
					</p>
					<p className="mt-1 text-sm text-muted-foreground">
						{t("about.meta.author", { name: AUTHOR_NAME })}
					</p>
				</SettingRow>
			</SettingPanel>
		</>
	);
}
