import { Palette, Settings } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/button";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { SettingPanel, SettingRow } from "@/features/settings/ui/setting-panel";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";

interface PopupSettingsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
}

export function PopupSettings({
	preferences,
	setPreferences,
}: PopupSettingsProps) {
	const [isEditingMessage, setIsEditingMessage] = useState(false);
	const [temporaryMessage, setTemporaryMessage] = useState("");

	const saveMessage = () => {
		setPreferences((current) => ({
			...current,
			popupMessage: temporaryMessage,
		}));
		setIsEditingMessage(false);
	};

	const updateColor = (key: "background" | "text", value: string) => {
		setPreferences((current) => ({
			...current,
			popupColors: { ...current.popupColors, [key]: value },
		}));
	};

	return (
		<SettingPanel>
			<SettingRow
				title={
					<>
						<Settings className="h-4 w-4 text-muted-foreground" aria-hidden />
						Popup Settings
					</>
				}
				description={`Current size: ${preferences.popupSize.width}px × ${preferences.popupSize.height}px`}
				action={
					<button
						type="button"
						onClick={() =>
							setPreferences((current) => ({
								...current,
								showPopupColors: !current.showPopupColors,
							}))
						}
						className="text-xs text-primary hover:underline"
					>
						{preferences.showPopupColors ? "Hide" : "Customize Appearance"}
					</button>
				}
			>
				<Button
					type="button"
					className="w-full gap-2"
					onClick={rendererIpc.showPopupEditor}
				>
					<Settings className="h-4 w-4" aria-hidden />
					Change Position or Size
				</Button>

				{preferences.showPopupColors ? (
					<div className="mt-4 space-y-4 border-t border-border pt-4">
						<div className="flex items-center gap-2 text-sm font-medium text-foreground">
							<Palette className="h-4 w-4 text-muted-foreground" aria-hidden />
							Popup Appearance
						</div>

						<div>
							<label
								htmlFor="popup-message"
								className="mb-1 block text-xs text-muted-foreground"
							>
								Popup Message
							</label>
							{isEditingMessage ? (
								<div className="space-y-2">
									<input
										id="popup-message"
										aria-label="Popup message"
										type="text"
										value={temporaryMessage}
										onChange={(event) =>
											setTemporaryMessage(event.target.value)
										}
										onKeyDown={(event) => {
											if (event.key === "Enter") saveMessage();
											else if (event.key === "Escape")
												setIsEditingMessage(false);
										}}
										className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
										ref={(input) => input?.focus()}
									/>
									<div className="flex items-center gap-2">
										<Button type="button" size="sm" onClick={saveMessage}>
											Save
										</Button>
										<Button
											type="button"
											size="sm"
											variant="secondary"
											onClick={() => setIsEditingMessage(false)}
										>
											Cancel
										</Button>
									</div>
								</div>
							) : (
								<div className="flex min-w-0 items-center gap-2">
									<p className="min-w-0 flex-1 truncate text-sm text-foreground">
										"{preferences.popupMessage}"
									</p>
									<button
										type="button"
										onClick={() => {
											setTemporaryMessage(preferences.popupMessage);
											setIsEditingMessage(true);
										}}
										className="shrink-0 text-xs text-primary hover:underline"
									>
										Edit
									</button>
								</div>
							)}
						</div>

						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<ColorSetting
								label="Background Color"
								value={preferences.popupColors.background}
								onChange={(value) => updateColor("background", value)}
							/>
							<ColorSetting
								label="Text Color"
								value={preferences.popupColors.text}
								onChange={(value) => updateColor("text", value)}
							/>
						</div>

						<div>
							<label
								htmlFor="window-transparency"
								className="mb-1 block text-xs text-muted-foreground"
							>
								Window Transparency
							</label>
							<div className="flex items-center gap-2">
								<input
									id="window-transparency"
									aria-label="Window transparency"
									type="range"
									min="0"
									max="1"
									step="0.1"
									value={preferences.popupColors.transparency}
									onChange={(event) =>
										setPreferences((current) => ({
											...current,
											popupColors: {
												...current.popupColors,
												transparency: Number.parseFloat(event.target.value),
											},
										}))
									}
									className="h-2 flex-1 cursor-pointer appearance-none rounded-lg bg-muted"
								/>
								<span className="w-12 text-right text-sm text-muted-foreground">
									{Math.round(preferences.popupColors.transparency * 100)}%
								</span>
							</div>
							<p className="mt-2 text-xs text-muted-foreground sm:text-sm">
								Higher values make the window more transparent.
							</p>
						</div>
					</div>
				) : null}
			</SettingRow>
		</SettingPanel>
	);
}

interface ColorSettingProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
}

function ColorSetting({ label, value, onChange }: ColorSettingProps) {
	const inputId = useId();

	return (
		<div>
			<label
				htmlFor={inputId}
				className="mb-1 block text-xs text-muted-foreground"
			>
				{label}
			</label>
			<div className="flex items-center gap-2">
				<input
					aria-label={`${label} picker`}
					type="color"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="h-10 w-10 cursor-pointer rounded-md border border-border"
				/>
				<input
					id={inputId}
					aria-label={label}
					type="text"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
					placeholder="#000000"
				/>
			</div>
		</div>
	);
}
