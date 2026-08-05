import { Zap } from "lucide-react";

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
		<div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 sm:p-6 overflow-hidden">
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-2">
					<Zap className="w-5 h-5 text-gray-600 dark:text-gray-400" />
					<span className="font-medium text-gray-800 dark:text-white text-sm sm:text-base">
						Keyboard Shortcut
					</span>
				</div>
			</div>
			<div className="space-y-4">
				<div className="flex items-center gap-2">
					<div
						aria-label="Current keyboard shortcut"
						className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-sm"
					>
						{isRecording ? (
							<span className="text-blue-600 dark:text-blue-400">
								{temporaryShortcut || "Press keys..."}
							</span>
						) : (
							shortcut
						)}
					</div>
					{isRecording ? (
						<div className="flex gap-2">
							<button
								type="button"
								onClick={onCancel}
								className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
							>
								Cancel
							</button>
							<button
								type="button"
								onClick={onSave}
								className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
							>
								Save
							</button>
						</div>
					) : (
						<button
							type="button"
							onClick={onStartRecording}
							className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
						>
							Change
						</button>
					)}
				</div>
				{error && <p className="text-red-500 text-sm">{error}</p>}
				<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
					Press the shortcut to start/stop reminders. Use at least one modifier
					key (Ctrl, Shift, Alt, Cmd, Win) and one regular key.
				</p>
			</div>
		</div>
	);
}
