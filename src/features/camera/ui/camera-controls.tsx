import { Activity, Camera, Crosshair, Gauge } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/button";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import {
	SettingPanel,
	SettingRow,
	ToggleSwitch,
} from "@/features/settings/ui/setting-panel";
import { useI18n, useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import {
	CAMERA_QUALITY_OPTIONS,
	CAMERA_QUALITY_PRESETS,
} from "../../../../shared/camera-quality";
import { t as translate } from "../../../../shared/i18n";
import type { CameraQuality } from "../../../../shared/preferences";

interface CameraErrorBannerProps {
	error: string | null;
	onDismiss: () => void;
}

export function CameraErrorBanner({
	error,
	onDismiss,
}: CameraErrorBannerProps) {
	const t = useT();
	if (!error) return null;

	return (
		<div className="mx-4 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-destructive sm:mx-6">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2 text-sm">
					<Camera className="h-4 w-4 shrink-0" aria-hidden />
					<span className="font-medium">{t("camera.error")}</span>
					<span className="truncate">{error}</span>
				</div>
				<button
					type="button"
					aria-label={t("camera.dismissError")}
					onClick={onDismiss}
					className="shrink-0 text-lg leading-none opacity-70 hover:opacity-100"
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
	const t = useT();
	const { locale } = useI18n();
	const [calibrating, setCalibrating] = useState(false);
	const [calibrationElapsedMs, setCalibrationElapsedMs] = useState(0);
	const [calibrationDurationMs, setCalibrationDurationMs] = useState(8000);
	const [calibrationMessage, setCalibrationMessage] = useState<string | null>(
		null,
	);

	const qualityLabels: Record<CameraQuality, string> = {
		performance: t("camera.quality.performance"),
		medium: t("camera.quality.medium"),
		high: t("camera.quality.high"),
	};

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
					translate(locale, "camera.calibrationSaved", {
						value: payload.baseline.toFixed(3),
					}),
				);
			} else {
				setCalibrationMessage(
					payload.error ?? translate(locale, "camera.calibrationIncomplete"),
				);
			}
		});
		return () => {
			offProgress();
			offComplete();
		};
	}, [locale, setPreferences]);

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
		setCalibrationMessage(t("camera.calibrationCancelled"));
	};

	const resetCalibration = () => {
		setPreferences((current) => ({
			...current,
			earCalibration: null,
		}));
		rendererIpc.updateEarCalibration(null);
		setCalibrationMessage(t("camera.calibrationCleared"));
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
			<SettingPanel>
				<SettingRow
					title={
						<>
							<Camera className="h-4 w-4 text-muted-foreground" aria-hidden />
							{t("camera.detection")}
						</>
					}
					action={
						<div className="flex items-center gap-2">
							{preferences.cameraEnabled ? (
								isWindowOpen ? (
									<Button
										type="button"
										size="sm"
										variant="destructive"
										onClick={() => {
											rendererIpc.closeCameraWindow();
											setIsWindowOpen(false);
										}}
									>
										{t("camera.stopShowing")}
									</Button>
								) : (
									<Button
										type="button"
										size="sm"
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
									>
										{t("camera.show")}
									</Button>
								)
							) : null}
							<ToggleSwitch
								aria-label={t("camera.toggleAria")}
								checked={preferences.cameraEnabled}
								onChange={toggleCamera}
							/>
						</div>
					}
				/>
			</SettingPanel>

			{preferences.cameraEnabled ? (
				<>
					<SettingPanel>
						<SettingRow
							title={t("camera.quality")}
							description={t("camera.qualityDesc")}
							action={
								<span className="text-xs text-muted-foreground">
									{activePreset.targetFps} FPS ·{" "}
									{activePreset.processingResolution[0]}×
									{activePreset.processingResolution[1]}
								</span>
							}
						>
							<fieldset
								aria-label={t("camera.qualityAria")}
								className="m-0 flex overflow-hidden rounded-md border border-border p-0"
							>
								{CAMERA_QUALITY_OPTIONS.map((option) => {
									const selected = preferences.cameraQuality === option;
									return (
										<button
											key={option}
											type="button"
											aria-pressed={selected}
											onClick={() => setCameraQuality(option)}
											className={cn(
												"flex-1 px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:text-sm",
												selected
													? "bg-primary text-primary-foreground"
													: "bg-background text-foreground hover:bg-muted",
											)}
										>
											{qualityLabels[option]}
										</button>
									);
								})}
							</fieldset>
						</SettingRow>
					</SettingPanel>

					<SettingPanel>
						<SettingRow
							title={
								<>
									<Crosshair
										className="h-4 w-4 text-muted-foreground"
										aria-hidden
									/>
									{t("camera.calibration")}
								</>
							}
							description={t("camera.calibrationDesc")}
							action={
								preferences.earCalibration !== null ? (
									<span className="text-xs text-primary">
										EAR {preferences.earCalibration.toFixed(3)}
									</span>
								) : null
							}
						>
							<div className="flex flex-wrap items-center gap-2">
								{calibrating ? (
									<Button
										type="button"
										size="sm"
										variant="secondary"
										onClick={cancelCalibration}
									>
										{t("camera.cancelCalibration", { n: remainingSec })}
									</Button>
								) : (
									<Button type="button" size="sm" onClick={startCalibration}>
										{t("camera.calibrate")}
									</Button>
								)}
								{preferences.earCalibration !== null && !calibrating ? (
									<Button
										type="button"
										size="sm"
										variant="ghost"
										onClick={resetCalibration}
									>
										{t("common.reset")}
									</Button>
								) : null}
							</div>
							{calibrating ? (
								<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
									<div
										className="h-full bg-primary transition-[width] duration-200"
										style={{ width: `${progressRatio * 100}%` }}
									/>
								</div>
							) : null}
							{calibrationMessage ? (
								<p className="mt-2 text-xs text-muted-foreground">
									{calibrationMessage}
								</p>
							) : null}
						</SettingRow>
					</SettingPanel>

					<SettingPanel>
						<SettingRow
							title={
								<>
									<Gauge
										className="h-4 w-4 text-muted-foreground"
										aria-hidden
									/>
									{t("camera.coaching")}
								</>
							}
							description={t("camera.coachingDesc")}
							action={
								<ToggleSwitch
									aria-label={t("camera.coachingToggleAria")}
									checked={preferences.blinkRateCoachingEnabled}
									onChange={() =>
										setPreferences((current) => ({
											...current,
											blinkRateCoachingEnabled:
												!current.blinkRateCoachingEnabled,
										}))
									}
								/>
							}
						>
							<div className="flex flex-wrap items-center gap-3">
								<label
									htmlFor="blink-rate-threshold"
									className="text-xs text-muted-foreground"
								>
									{t("camera.minBlinks")}
								</label>
								<input
									id="blink-rate-threshold"
									type="number"
									min={1}
									max={60}
									step={1}
									disabled={!preferences.blinkRateCoachingEnabled}
									value={preferences.blinkRateThresholdPerMin}
									onChange={(event) => {
										const value = Number.parseInt(event.target.value, 10);
										if (!Number.isFinite(value)) return;
										setPreferences((current) => ({
											...current,
											blinkRateThresholdPerMin: value,
										}));
									}}
									className="w-20 rounded-md border border-border bg-background px-2 py-1 text-sm disabled:opacity-50"
								/>
							</div>
						</SettingRow>
					</SettingPanel>

					<SettingPanel>
						<SettingRow
							title={
								<>
									<Activity
										className="h-4 w-4 text-muted-foreground"
										aria-hidden
									/>
									{t("camera.mgd")}
								</>
							}
							description={t("camera.mgdDesc")}
							action={
								<ToggleSwitch
									aria-label={t("camera.mgdToggleAria")}
									checked={preferences.mgdMode}
									onChange={toggleMgd}
								/>
							}
						>
							<div className="flex flex-wrap items-center gap-2">
								<button
									type="button"
									onClick={() =>
										setPreferences((current) => ({
											...current,
											showMgdInfo: !current.showMgdInfo,
										}))
									}
									className="text-xs text-primary hover:underline"
								>
									{preferences.showMgdInfo
										? t("common.hideInfo")
										: t("common.learnMore")}
								</button>
								{preferences.mgdMode ? (
									<span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
										{t("camera.mgdActive")}
									</span>
								) : null}
							</div>
							{preferences.showMgdInfo ? (
								<div className="mt-2 rounded-md bg-accent/60 p-3 text-xs text-muted-foreground sm:text-sm">
									{t("camera.mgdInfo")}
								</div>
							) : null}
						</SettingRow>
					</SettingPanel>
				</>
			) : null}
		</>
	);
}
