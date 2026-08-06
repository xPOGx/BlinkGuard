import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import {
	CAMERA_QUALITY_OPTIONS,
	CAMERA_QUALITY_PRESETS,
} from "../../../../shared/camera-quality";
import type { CameraQuality } from "../../../../shared/preferences";
import { Activity, Camera, Crosshair } from "lucide-react";
import { useEffect, useState } from "react";

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

const QUALITY_LABELS: Record<CameraQuality, string> = {
	performance: "Performance",
	medium: "Medium",
	high: "High",
};

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
	const [calibrating, setCalibrating] = useState(false);
	const [calibrationElapsedMs, setCalibrationElapsedMs] = useState(0);
	const [calibrationDurationMs, setCalibrationDurationMs] = useState(8000);
	const [calibrationMessage, setCalibrationMessage] = useState<string | null>(
		null,
	);

	useEffect(() => {
		const offProgress = rendererIpc.onEarCalibrationProgress((payload) => {
			setCalibrating(true);
			setCalibrationElapsedMs(payload.elapsedMs);
			setCalibrationDurationMs(payload.durationMs);
		});
		const offComplete = rendererIpc.onEarCalibrationComplete((payload) => {
			setCalibrating(false);
			setCalibrationElapsedMs(0);
			if (payload.baseline !== null) {
				setPreferences((current) => ({
					...current,
					earCalibration: payload.baseline,
				}));
				setCalibrationMessage(
					`Calibration saved (EAR ${payload.baseline.toFixed(3)})`,
				);
			} else {
				setCalibrationMessage(
					payload.error ?? "Calibration did not complete",
				);
			}
		});
		return () => {
			offProgress();
			offComplete();
		};
	}, [setPreferences]);

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

	const setCameraQuality = (cameraQuality: CameraQuality) => {
		if (cameraQuality === preferences.cameraQuality) return;
		setPreferences((current) => ({ ...current, cameraQuality }));
		rendererIpc.updateCameraQuality(cameraQuality);
	};

	const startCalibration = () => {
		setCalibrationMessage(null);
		setCalibrating(true);
		setCalibrationElapsedMs(0);
		if (!preferences.cameraEnabled) {
			setPreferences((current) => ({
				...current,
				cameraEnabled: true,
			}));
		}
		rendererIpc.startEarCalibration();
	};

	const cancelCalibration = () => {
		rendererIpc.cancelEarCalibration();
		setCalibrating(false);
		setCalibrationElapsedMs(0);
		setCalibrationMessage("Calibration cancelled");
	};

	const resetCalibration = () => {
		setPreferences((current) => ({
			...current,
			earCalibration: null,
		}));
		rendererIpc.updateEarCalibration(null);
		setCalibrationMessage("Calibration cleared");
	};

	const toggleMediaPipe = () => {
		const enabled = !preferences.useMediaPipe;
		setPreferences((current) => ({
			...current,
			useMediaPipe: enabled,
		}));
		rendererIpc.updateUseMediaPipe(enabled);
	};

	const activePreset = CAMERA_QUALITY_PRESETS[preferences.cameraQuality];
	const progressRatio = calibrating
		? Math.min(1, calibrationElapsedMs / Math.max(1, calibrationDurationMs))
		: 0;
	const remainingSec = Math.max(
		0,
		Math.ceil((calibrationDurationMs - calibrationElapsedMs) / 1000),
	);

	return (
		<>
			<div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-hidden">
				<span className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
					<Camera className="w-4 h-4" />
					Camera Detection
				</span>
				<div className="flex items-center gap-2">
					{preferences.cameraEnabled &&
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
									if (!preferences.isTracking) {
										setPreferences((current) => ({
											...current,
											isTracking: true,
										}));
									}
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
						className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
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
						<span className="text-sm font-medium text-gray-700 dark:text-gray-200">
							Camera Quality
						</span>
						<span className="text-xs text-gray-500 dark:text-gray-400">
							{activePreset.targetFps} FPS ·{" "}
							{activePreset.processingResolution[0]}×
							{activePreset.processingResolution[1]}
						</span>
					</div>
					<div
						role="group"
						aria-label="Camera quality"
						className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600"
					>
						{CAMERA_QUALITY_OPTIONS.map((option) => {
							const selected = preferences.cameraQuality === option;
							return (
								<button
									key={option}
									type="button"
									aria-pressed={selected}
									onClick={() => setCameraQuality(option)}
									className={`flex-1 px-2 py-1.5 text-xs sm:text-sm font-medium transition-colors focus:outline-hidden focus:ring-2 focus:ring-inset focus:ring-blue-500 ${
										selected
											? "bg-blue-600 text-white"
											: "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
									}`}
								>
									{QUALITY_LABELS[option]}
								</button>
							);
						})}
					</div>
					<p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
						Medium is recommended. Performance saves CPU; High improves blink
						timing accuracy.
					</p>
				</div>
			)}

			{preferences.cameraEnabled && (
				<div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-hidden">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<Crosshair className="w-4 h-4 text-gray-600 dark:text-gray-400" />
							<span className="text-sm font-medium text-gray-700 dark:text-gray-200">
								Open-eye Calibration
							</span>
						</div>
						{preferences.earCalibration !== null && (
							<span className="text-xs text-green-600 dark:text-green-400">
								EAR {preferences.earCalibration.toFixed(3)}
							</span>
						)}
					</div>
					<p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
						Keep eyes open and look at the camera for about 8 seconds. This
						tunes blink thresholds to your face.
					</p>
					<div className="flex flex-wrap items-center gap-2">
						{calibrating ? (
							<button
								type="button"
								onClick={cancelCalibration}
								className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
							>
								Cancel ({remainingSec}s)
							</button>
						) : (
							<button
								type="button"
								onClick={startCalibration}
								className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
							>
								Calibrate
							</button>
						)}
						{preferences.earCalibration !== null && !calibrating && (
							<button
								type="button"
								onClick={resetCalibration}
								className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
							>
								Reset
							</button>
						)}
					</div>
					{calibrating && (
						<div className="mt-3 h-1.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
							<div
								className="h-full bg-blue-600 transition-[width] duration-200"
								style={{ width: `${progressRatio * 100}%` }}
							/>
						</div>
					)}
					{calibrationMessage && (
						<p className="mt-2 text-xs text-gray-600 dark:text-gray-300">
							{calibrationMessage}
						</p>
					)}
				</div>
			)}

			{preferences.cameraEnabled && (
				<div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 overflow-hidden">
					<div className="flex items-center justify-between mb-2">
						<div className="flex items-center gap-2">
							<span className="text-sm font-medium text-gray-700 dark:text-gray-200">
								MediaPipe Backend
							</span>
							<span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
								Experimental
							</span>
						</div>
						<button
							type="button"
							aria-label="Toggle MediaPipe backend"
							onClick={toggleMediaPipe}
							className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
								preferences.useMediaPipe
									? "bg-blue-600"
									: "bg-gray-300 dark:bg-gray-600"
							}`}
						>
							<span
								className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
									preferences.useMediaPipe ? "translate-x-6" : "translate-x-1"
								}`}
							/>
						</button>
					</div>
					<p className="text-xs text-gray-500 dark:text-gray-400">
						Architecture flag only — MediaPipe is not bundled yet. When
						enabled, the detector stays on dlib and reports that fallback.
					</p>
				</div>
			)}

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
