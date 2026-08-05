import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { Activity, Camera } from "lucide-react";

interface CameraErrorBannerProps {
	error: string | null;
	onDismiss: () => void;
}

export function CameraErrorBanner({
	error,
	onDismiss,
}: CameraErrorBannerProps) {
	if (!error) return null;

	return (
		<div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg mx-4 mt-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Camera className="w-4 h-4" />
					<span className="font-medium">Camera Error:</span>
					<span>{error}</span>
				</div>
				<button
					type="button"
					aria-label="Dismiss camera error"
					onClick={onDismiss}
					className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
				>
					×
				</button>
			</div>
		</div>
	);
}

interface CameraControlsProps {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
	isWindowOpen: boolean;
	setIsWindowOpen: (open: boolean) => void;
}

export function CameraControls({
	preferences,
	setPreferences,
	isWindowOpen,
	setIsWindowOpen,
}: CameraControlsProps) {
	const toggleCamera = () => {
		const enabled = !preferences.cameraEnabled;
		const update = () => {
			setPreferences((current) => ({
				...current,
				isTracking: false,
				cameraEnabled: enabled,
			}));
			if (enabled) rendererIpc.startCameraTracking();
			else rendererIpc.stopCameraTracking();
		};

		if (preferences.isTracking) {
			rendererIpc.stopReminders();
			setTimeout(update, 100);
		} else {
			update();
		}
	};

	const toggleMgd = () => {
		const enabled = !preferences.mgdMode;
		if (preferences.isTracking) rendererIpc.stopReminders();
		setPreferences((current) => ({
			...current,
			isTracking: false,
			mgdMode: enabled,
		}));
		rendererIpc.updateMgdMode(enabled);
	};

	return (
		<>
			<div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-hidden">
				<span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
					<Camera className="w-4 h-4" />
					Camera Detection
				</span>
				<div className="flex items-center gap-2">
					{preferences.isTracking &&
						preferences.cameraEnabled &&
						(isWindowOpen ? (
							<button
								type="button"
								onClick={() => {
									rendererIpc.closeCameraWindow();
									setIsWindowOpen(false);
								}}
								className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
							>
								Stop Showing
							</button>
						) : (
							<button
								type="button"
								onClick={() => {
									rendererIpc.showCameraWindow();
									setIsWindowOpen(true);
								}}
								className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
							>
								Show Camera
							</button>
						))}
					<button
						type="button"
						aria-label="Toggle camera detection"
						onClick={toggleCamera}
						className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
							preferences.cameraEnabled
								? "bg-blue-600"
								: "bg-gray-200 dark:bg-gray-600"
						}`}
					>
						<span
							className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
								preferences.cameraEnabled ? "translate-x-6" : "translate-x-1"
							}`}
						/>
					</button>
				</div>
			</div>

			{preferences.cameraEnabled && (
				<div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-hidden">
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-2">
							<Activity className="w-4 h-4 text-gray-600 dark:text-gray-400" />
							<span className="text-sm font-medium text-gray-700 dark:text-gray-200">
								Meibomian Gland Dysfunction (MGD) Mode
							</span>
						</div>
						<button
							type="button"
							aria-label="Toggle MGD mode"
							onClick={toggleMgd}
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
								preferences.mgdMode
									? "bg-blue-600"
									: "bg-gray-300 dark:bg-gray-600"
							}`}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
									preferences.mgdMode ? "translate-x-6" : "translate-x-1"
								}`}
							/>
						</button>
					</div>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() =>
								setPreferences((current) => ({
									...current,
									showMgdInfo: !current.showMgdInfo,
								}))
							}
							className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
						>
							{preferences.showMgdInfo ? "Hide Info" : "Learn More"}
						</button>
						{preferences.mgdMode && (
							<span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded">
								MGD mode is active
							</span>
						)}
					</div>
					{preferences.showMgdInfo && (
						<div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
							<p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
								MGD is a common condition where the meibomian glands in your
								eyelids don't produce enough oil, leading to dry eyes. When
								enabled, reminders appear at regular intervals regardless of
								detected blinks. The popup still closes when a blink is
								detected.
							</p>
						</div>
					)}
				</div>
			)}
		</>
	);
}
