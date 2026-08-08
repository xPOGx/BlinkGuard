import { Zap } from "lucide-react";
import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/components/setting-panel";
import { useT } from "@/i18n";

interface ShortcutSettingsProps {
	shortcut: string;
	isRecording: boolean;
	temporaryShortcut: string;
	error: string;
	onStartRecording: () => void;
	onSave: () => void;
	onCancel: () => void;
}

export function ShortcutSettings({
	shortcut,
	isRecording,
	temporaryShortcut,
	error,
	onStartRecording,
	onSave,
	onCancel,
}: ShortcutSettingsProps) {
	const t = useT();
	return (
		<SettingPanel>
			<SettingRow
				title={
					<>
						<Zap className="h-4 w-4 text-muted-foreground" aria-hidden />
						{t("shortcut.title")}
					</>
				}
				description={t("shortcut.description")}
			>
				<div className="flex items-center gap-2">
					<div
						role="status"
						aria-label={t("shortcut.currentAria")}
						className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{isRecording ? (
							<span className="text-primary">
								{temporaryShortcut || t("shortcut.pressKeys")}
							</span>
						) : (
							shortcut
						)}
					</div>
					{isRecording ? (
						<div className="flex gap-2">
							<Button type="button" variant="secondary" onClick={onCancel}>
								{t("common.cancel")}
							</Button>
							<Button type="button" onClick={onSave}>
								{t("common.save")}
							</Button>
						</div>
					) : (
						<Button type="button" onClick={onStartRecording}>
							{t("common.change")}
						</Button>
					)}
				</div>
				{error ? (
					<p className="mt-2 select-text text-sm text-destructive">{error}</p>
				) : null}
			</SettingRow>
		</SettingPanel>
	);
}
