import { Zap } from "lucide-react";
import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/features/settings/ui/setting-panel";

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
	return (
		<SettingPanel>
			<SettingRow
				title={
					<>
						<Zap className="h-4 w-4 text-muted-foreground" aria-hidden />
						Keyboard Shortcut
					</>
				}
				description="Press the shortcut to start/stop reminders. Use at least one modifier key (Ctrl, Shift, Alt, Cmd, Win) and one regular key."
			>
				<div className="flex items-center gap-2">
					<div
						role="status"
						aria-label="Current keyboard shortcut"
						className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
					>
						{isRecording ? (
							<span className="text-primary">
								{temporaryShortcut || "Press keys..."}
							</span>
						) : (
							shortcut
						)}
					</div>
					{isRecording ? (
						<div className="flex gap-2">
							<Button type="button" variant="secondary" onClick={onCancel}>
								Cancel
							</Button>
							<Button type="button" onClick={onSave}>
								Save
							</Button>
						</div>
					) : (
						<Button type="button" onClick={onStartRecording}>
							Change
						</Button>
					)}
				</div>
				{error ? (
					<p className="mt-2 text-sm text-destructive">{error}</p>
				) : null}
			</SettingRow>
		</SettingPanel>
	);
}
