import { Button } from "@/components/button";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import {
	SettingPanel,
	SettingRow,
} from "@/features/settings/ui/setting-panel";
import { useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type { DebugOverlayKind } from "../../../../shared/debug-preview";

interface DebugPanelProps {
	setPreferences: SetPreferences;
}

const OVERLAY_BUTTONS: { kind: DebugOverlayKind; labelKey: string }[] = [
	{ kind: "blink", labelKey: "debug.preview.blink" },
	{ kind: "starting", labelKey: "debug.preview.starting" },
	{ kind: "stopped", labelKey: "debug.preview.stopped" },
	{ kind: "coach", labelKey: "debug.preview.coach" },
	{ kind: "noFace", labelKey: "debug.preview.noFace" },
	{ kind: "lookAway", labelKey: "debug.preview.lookAway" },
	{ kind: "exercise", labelKey: "debug.preview.exercise" },
];

export function DebugPanel({ setPreferences }: DebugPanelProps) {
	const t = useT();

	return (
		<>
			<SettingPanel>
				<SettingRow
					title={t("debug.overlays.title")}
					description={t("debug.overlays.desc")}
				>
					<div className="flex flex-wrap gap-2">
						{OVERLAY_BUTTONS.map(({ kind, labelKey }) => (
							<Button
								key={kind}
								type="button"
								variant="secondary"
								onClick={() => rendererIpc.debugPreviewOverlay(kind)}
							>
								{t(labelKey)}
							</Button>
						))}
					</div>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("debug.onboarding.title")}
					description={t("debug.onboarding.desc")}
					action={
						<Button
							type="button"
							variant="secondary"
							onClick={() =>
								setPreferences((current) => ({
									...current,
									hasCompletedOnboarding: false,
								}))
							}
						>
							{t("reset.showOnboarding")}
						</Button>
					}
				/>
			</SettingPanel>
		</>
	);
}
