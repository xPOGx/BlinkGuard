import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { Palette, Settings } from "lucide-react";
import { useId, useState } from "react";

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
		<div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 sm:p-6 overflow-hidden">
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
					<span className="font-medium text-gray-800 dark:text-white text-sm sm:text-base">
						Popup Settings
					</span>
				</div>
				<button
					type="button"
					onClick={() =>
						setPreferences((current) => ({
							...current,
							showPopupColors: !current.showPopupColors,
						}))
					}
					className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
				>
					{preferences.showPopupColors ? "Hide" : "Customize Appearance"}
				</button>
			</div>
			<div className="mt-2">
				<button
					type="button"
					onClick={rendererIpc.showPopupEditor}
					className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
				>
					<Settings className="w-4 h-4" />
					Change Position or Size
				</button>
			</div>
			<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
				Current size: {preferences.popupSize.width}px ×{" "}
				{preferences.popupSize.height}px
			</p>

			{preferences.showPopupColors && (
				<div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
					<div className="flex items-center gap-2 mb-3">
						<Palette className="w-4 h-4 text-gray-600 dark:text-gray-400" />
						<span className="font-medium text-gray-800 dark:text-white text-sm">
							Popup Appearance
						</span>
					</div>
					<div className="space-y-4">
						<div>
							<label
								htmlFor="popup-message"
								className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
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
										className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
										ref={(input) => input?.focus()}
									/>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={saveMessage}
											className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
										>
											Save
										</button>
										<button
											type="button"
											onClick={() => setIsEditingMessage(false)}
											className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
										>
											Cancel
										</button>
									</div>
								</div>
							) : (
								<div className="flex items-center gap-2 min-w-0">
									<p className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate min-w-0 overflow-hidden">
										"{preferences.popupMessage}"
									</p>
									<button
										type="button"
										onClick={() => {
											setTemporaryMessage(preferences.popupMessage);
											setIsEditingMessage(true);
										}}
										className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex-shrink-0"
									>
										Edit
									</button>
								</div>
							)}
						</div>

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

						<div>
							<label
								htmlFor="window-transparency"
								className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
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
									className="flex-1 h-2 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer"
								/>
								<span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
									{Math.round(preferences.popupColors.transparency * 100)}%
								</span>
							</div>
						</div>
					</div>
					<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-2">
						Customize the transparency of the entire popup window. Higher values
						make the window more transparent, allowing you to see through to
						what's behind it.
					</p>
				</div>
			)}
		</div>
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
				className="block text-xs text-gray-600 dark:text-gray-400 mb-1"
			>
				{label}
			</label>
			<div className="flex items-center gap-2">
				<input
					aria-label={`${label} picker`}
					type="color"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="w-10 h-10 rounded cursor-pointer"
				/>
				<input
					id={inputId}
					aria-label={label}
					type="text"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded"
					placeholder="#000000"
				/>
			</div>
		</div>
	);
}
