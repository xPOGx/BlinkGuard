import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/components/setting-panel";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type {
	DebugOverlayKind,
	DebugSoundKind,
} from "../../../../shared/debug-preview";

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

const SOUND_BUTTONS: { kind: DebugSoundKind; labelKey: string }[] = [
	{ kind: "blink", labelKey: "debug.sound.blink" },
	{ kind: "exercise", labelKey: "debug.sound.exercise" },
	{ kind: "lookAway", labelKey: "debug.sound.lookAway" },
	{ kind: "starting", labelKey: "debug.sound.starting" },
	{ kind: "stopped", labelKey: "debug.sound.stopped" },
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
					title={t("debug.sounds.title")}
					description={t("debug.sounds.desc")}
				>
					<div className="flex flex-wrap gap-2">
						{SOUND_BUTTONS.map(({ kind, labelKey }) => (
							<Button
								key={kind}
								type="button"
								variant="secondary"
								onClick={() => rendererIpc.debugPreviewSound(kind)}
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
