import {
	Activity,
	Camera,
	Crosshair,
	Gauge,
	RefreshCw,
	UserRoundX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/button";
import { RangeSlider } from "@/components/range-slider";
import { SettingGrid } from "@/components/setting-grid";
import { SettingPanel } from "@/components/setting-panel";
import { SettingRow } from "@/components/setting-row";
import { ToggleSwitch } from "@/components/toggle-switch";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { useI18n, useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import {
	activeCalibrationNudgeReason,
	type CalibrationNudgeReason,
} from "../../../../shared/calibration-freshness";
import {
	CAMERA_QUALITY_OPTIONS,
	CAMERA_QUALITY_PRESETS,
} from "../../../../shared/camera-quality";
import {
	type CalibrationPhase,
	CLASSIFIER_CALIBRATION_MIN_BLINKS,
} from "../../../../shared/classifier-calibration";
import { EAR_CALIBRATION_MIN_SAMPLES } from "../../../../shared/ear-calibration";
import { pluralKey, t as translate } from "../../../../shared/i18n";
import type { CameraQuality } from "../../../../shared/preferences";
import { CameraCalibrationBanner } from "./camera-calibration-banner";
import { CameraDevicePicker } from "./camera-device-picker";

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
	const [calibrationSampleCount, setCalibrationSampleCount] = useState(0);
	const [calibrationFaceDetected, setCalibrationFaceDetected] = useState(false);
	const [calibrationPhase, setCalibrationPhase] =
		useState<CalibrationPhase>("open_eye");
	const [calibrationBlinkCount, setCalibrationBlinkCount] = useState(0);
	const [calibrationMessage, setCalibrationMessage] = useState<string | null>(
		null,
	);
	const [liveNudgeReason, setLiveNudgeReason] = useState<
		CalibrationNudgeReason | null | undefined
	>(undefined);
	const calibrationSampleCountRef = useRef(0);
	const calibrationBlinkCountRef = useRef(0);

	const resetCalibrationProgress = useCallback(() => {
		setCalibrationElapsedMs(0);
		calibrationSampleCountRef.current = 0;
		calibrationBlinkCountRef.current = 0;
		setCalibrationSampleCount(0);
		setCalibrationBlinkCount(0);
		setCalibrationFaceDetected(false);
		setCalibrationPhase("open_eye");
	}, []);

	const qualityLabels: Record<CameraQuality, string> = {
		performance: t("camera.quality.performance"),
		medium: t("camera.quality.medium"),
		high: t("camera.quality.high"),
		ultra: t("camera.quality.ultra"),
	};

	const autoStopMinutes = preferences.autoStopNoFaceMinutes;
	const autoStopDescKey = pluralKey(
		"camera.autoStopNoFaceDesc",
		locale,
		autoStopMinutes,
	);

	useEffect(() => {
		const offProgress = rendererIpc.onEarCalibrationProgress((payload) => {
			setCalibrating(true);
			setCalibrationElapsedMs(payload.elapsedMs);
			setCalibrationDurationMs(payload.durationMs);
			calibrationSampleCountRef.current = payload.sampleCount;
			setCalibrationSampleCount(payload.sampleCount);
			setCalibrationFaceDetected(Boolean(payload.faceDetected));
			setCalibrationPhase(payload.phase ?? "open_eye");
			const blinks = payload.blinkCount ?? 0;
			calibrationBlinkCountRef.current = blinks;
			setCalibrationBlinkCount(blinks);
		});
		const offComplete = rendererIpc.onEarCalibrationComplete((payload) => {
			setCalibrating(false);
			const samples = calibrationSampleCountRef.current;
			const blinks = calibrationBlinkCountRef.current;
			if (payload.baseline !== null) {
				setPreferences((current) => ({
					...current,
					earCalibration: payload.baseline,
					calibrationAt: Date.now(),
					calibrationNudgeDismissedAt: null,
					lastBaselineDriftAt: null,
					...(typeof payload.classifierBias === "number"
						? {
								classifierBias: payload.classifierBias,
								classifierThreshold: payload.classifierThreshold ?? null,
							}
						: {}),
				}));
				setLiveNudgeReason(null);
				if (typeof payload.classifierBias === "number") {
					setCalibrationMessage(
						translate(locale, "camera.calibrationSaved", {
							value: payload.baseline.toFixed(3),
						}),
					);
				} else {
					setCalibrationMessage(
						translate(locale, "camera.calibrationPartialBlinks", {
							value: payload.baseline.toFixed(3),
							n: blinks,
							min: CLASSIFIER_CALIBRATION_MIN_BLINKS,
						}),
					);
				}
			} else if (payload.error === "Calibration cancelled") {
				setCalibrationMessage(translate(locale, "camera.calibrationCancelled"));
			} else {
				setCalibrationMessage(
					translate(locale, "camera.calibrationIncompleteSamples", {
						n: samples,
						min: EAR_CALIBRATION_MIN_SAMPLES,
					}),
				);
			}
			resetCalibrationProgress();
		});
		const offNudge = rendererIpc.onCalibrationNudge((payload) => {
			setLiveNudgeReason(payload.reason);
		});
		return () => {
			offProgress();
			offComplete();
			offNudge();
		};
	}, [locale, setPreferences, resetCalibrationProgress]);

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
		resetCalibrationProgress();
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
		resetCalibrationProgress();
		setCalibrationMessage(t("camera.calibrationCancelled"));
	};

	const resetCalibration = () => {
		setPreferences((current) => ({
			...current,
			earCalibration: null,
			calibrationAt: null,
			calibrationNudgeDismissedAt: null,
			lastBaselineDriftAt: null,
			classifierBias: null,
			classifierThreshold: null,
		}));
		setLiveNudgeReason(null);
		rendererIpc.updateEarCalibration(null);
		rendererIpc.updateClassifierCalibration({
			bias: null,
			threshold: null,
		});
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
	const cameraOn = preferences.cameraEnabled;
	const savedEar = preferences.earCalibration;
	const savedClassifier = preferences.classifierBias !== null;
	const hasSavedCalibration = savedEar !== null || savedClassifier;
	const earBadge =
		savedEar !== null && savedClassifier
			? `EAR ${savedEar.toFixed(3)} · clf`
			: savedEar !== null
				? `EAR ${savedEar.toFixed(3)}`
				: savedClassifier
					? "clf"
					: null;
	const prefsNudgeReason = activeCalibrationNudgeReason({
		earCalibration: preferences.earCalibration,
		calibrationAt: preferences.calibrationAt,
		dismissedAt: preferences.calibrationNudgeDismissedAt,
		driftAt: preferences.lastBaselineDriftAt,
		now: Date.now(),
	});
	const nudgeReason =
		liveNudgeReason === undefined ? prefsNudgeReason : liveNudgeReason;
	const lastCalibratedLabel =
		savedEar === null
			? null
			: preferences.calibrationAt == null
				? t("camera.lastCalibratedUnknown")
				: t("camera.lastCalibrated", {
						date: new Date(preferences.calibrationAt).toLocaleDateString(
							locale === "uk" ? "uk-UA" : "en-GB",
							{ year: "numeric", month: "short", day: "numeric" },
						),
					});

	const dismissCalibrationNudge = () => {
		setPreferences((current) => ({
			...current,
			calibrationNudgeDismissedAt: Date.now(),
		}));
		setLiveNudgeReason(null);
		rendererIpc.dismissCalibrationNudge();
	};

	return (
		<>
			<CameraCalibrationBanner
				reason={nudgeReason}
				calibrating={calibrating}
				onRecalibrate={startCalibration}
				onDismiss={dismissCalibrationNudge}
			/>
			<SettingGrid>
				<SettingPanel
					className={cn(
						"h-full",
						cameraOn
							? "border-primary/40 bg-primary/5"
							: "border-warning/40 bg-warning/10",
					)}
				>
					<SettingRow
						title={
							<>
								<Camera
									className={cn(
										"h-4 w-4",
										cameraOn ? "text-primary" : "text-warning",
									)}
									aria-hidden
								/>
								<span
									className={cn(
										cameraOn ? "text-primary" : "text-warning-foreground",
									)}
								>
									{t("camera.detection")}
								</span>
							</>
						}
						description={
							<span className="inline-grid w-full grid-cols-1 grid-rows-1">
								<span className="invisible col-start-1 row-start-1" aria-hidden>
									{t("camera.detectionDesc")}
								</span>
								<span className="invisible col-start-1 row-start-1" aria-hidden>
									{t("camera.detectionDescOn")}
								</span>
								<span
									className={cn(
										"col-start-1 row-start-1",
										cameraOn ? "text-primary/80" : "text-warning-foreground/85",
									)}
								>
									{cameraOn
										? t("camera.detectionDescOn")
										: t("camera.detectionDesc")}
								</span>
							</span>
						}
						action={
							<ToggleSwitch
								aria-label={t("camera.toggleAria")}
								checked={cameraOn}
								onChange={toggleCamera}
							/>
						}
					>
						{/* Keep button slot reserved so the row height stays stable. */}
						<div className={cn(!cameraOn && "invisible pointer-events-none")}>
							{isWindowOpen ? (
								<Button
									type="button"
									size="sm"
									variant="destructive"
									tabIndex={cameraOn ? undefined : -1}
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
									tabIndex={cameraOn ? undefined : -1}
									onClick={() => {
										rendererIpc.showCameraWindow();
										setIsWindowOpen(true);
									}}
								>
									{t("camera.show")}
								</Button>
							)}
						</div>
					</SettingRow>
				</SettingPanel>

				<SettingPanel className={cn("h-full", !cameraOn && "opacity-60")}>
					<SettingRow
						title={
							<>
								<UserRoundX
									className="h-4 w-4 text-muted-foreground"
									aria-hidden
								/>
								{t("camera.autoStopNoFace")}
							</>
						}
						description={t(autoStopDescKey, { n: autoStopMinutes })}
						action={
							<ToggleSwitch
								aria-label={t("camera.autoStopNoFaceToggleAria")}
								checked={preferences.autoStopNoFaceEnabled}
								disabled={!cameraOn}
								onChange={() =>
									setPreferences((current) => ({
										...current,
										autoStopNoFaceEnabled: !current.autoStopNoFaceEnabled,
									}))
								}
							/>
						}
					>
						<div
							className={cn(
								"flex items-center gap-2",
								(!cameraOn || !preferences.autoStopNoFaceEnabled) &&
									"opacity-50",
							)}
						>
							<RangeSlider
								aria-label={t("camera.autoStopNoFaceIntervalAria")}
								min={1}
								max={30}
								value={autoStopMinutes}
								disabled={!cameraOn || !preferences.autoStopNoFaceEnabled}
								onChange={(autoStopNoFaceMinutes) =>
									setPreferences((current) => ({
										...current,
										autoStopNoFaceMinutes,
									}))
								}
								className="h-1.5 flex-1"
							/>
							<div className="min-w-[2.5rem] text-center text-xs font-medium text-primary">
								{autoStopMinutes}m
							</div>
						</div>
					</SettingRow>
				</SettingPanel>
			</SettingGrid>

			<CameraDevicePicker
				preferences={preferences}
				setPreferences={setPreferences}
			/>

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

					<SettingGrid>
						<SettingPanel className="h-full">
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
									{hasSavedCalibration && !calibrating ? (
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
								{earBadge || lastCalibratedLabel ? (
									<p className="mt-2 select-text text-xs">
										{earBadge ? (
											<span className="text-primary">{earBadge}</span>
										) : null}
										{lastCalibratedLabel ? (
											<span className="mt-0.5 block text-muted-foreground">
												{lastCalibratedLabel}
											</span>
										) : null}
									</p>
								) : null}
								{calibrating ? (
									<>
										<div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
											<div
												className="h-full bg-primary transition-[width] duration-200"
												style={{ width: `${progressRatio * 100}%` }}
											/>
										</div>
										<p className="mt-2 text-xs text-muted-foreground">
											{calibrationPhase === "blinks"
												? t("camera.calibrationPhaseBlinks")
												: t("camera.calibrationPhaseOpenEye")}
											{" · "}
											{calibrationPhase === "blinks"
												? t("camera.calibrationBlinkProgress", {
														n: calibrationBlinkCount,
														min: CLASSIFIER_CALIBRATION_MIN_BLINKS,
													})
												: t("camera.calibrationProgress", {
														n: calibrationSampleCount,
														min: EAR_CALIBRATION_MIN_SAMPLES,
													})}
											{" · "}
											{calibrationFaceDetected
												? t("camera.calibrationFaceOk")
												: t("camera.calibrationFaceMissing")}
										</p>
									</>
								) : null}
								{calibrationMessage ? (
									<p className="mt-2 select-text text-xs text-muted-foreground">
										{calibrationMessage}
									</p>
								) : null}
							</SettingRow>
						</SettingPanel>

						<SettingPanel className="h-full">
							<SettingRow
								title={
									<>
										<RefreshCw
											className="h-4 w-4 text-muted-foreground"
											aria-hidden
										/>
										{t("camera.calibrationNudge")}
									</>
								}
								description={t("camera.calibrationNudgeDesc")}
								action={
									<ToggleSwitch
										aria-label={t("camera.calibrationNudgeToggleAria")}
										checked={preferences.calibrationNudgeEnabled}
										onChange={() =>
											setPreferences((current) => ({
												...current,
												calibrationNudgeEnabled:
													!current.calibrationNudgeEnabled,
											}))
										}
									/>
								}
							/>
						</SettingPanel>
					</SettingGrid>

					<SettingGrid>
						<SettingPanel className="h-full">
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
									<span
										className={cn(
											"rounded bg-primary/10 px-2 py-0.5 text-xs text-primary",
											!preferences.mgdMode && "invisible",
										)}
									>
										{t("camera.mgdActive")}
									</span>
								</div>
								{preferences.showMgdInfo ? (
									<div className="mt-2 rounded-md bg-accent/60 p-3 text-xs text-muted-foreground sm:text-sm">
										{t("camera.mgdInfo")}
									</div>
								) : null}
							</SettingRow>
						</SettingPanel>

						<SettingPanel className="h-full">
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
					</SettingGrid>
				</>
			) : null}
		</>
	);
}
