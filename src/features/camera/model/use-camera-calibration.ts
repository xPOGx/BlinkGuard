import { useCallback, useEffect, useRef, useState } from "react";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { useI18n, useT } from "@/i18n";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import {
	activeCalibrationNudgeReason,
	type CalibrationNudgeReason,
} from "../../../../shared/calibration-freshness";
import {
	type CalibrationPhase,
	CLASSIFIER_CALIBRATION_MIN_BLINKS,
} from "../../../../shared/classifier-calibration";
import { EAR_CALIBRATION_MIN_SAMPLES } from "../../../../shared/ear-calibration";
import { t as translate } from "../../../../shared/i18n";

export function useCameraCalibration(
	preferences: SettingsPreferences,
	setPreferences: SetPreferences,
) {
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

	const startCalibration = useCallback(() => {
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
	}, [preferences.cameraEnabled, setPreferences, resetCalibrationProgress]);

	const cancelCalibration = useCallback(() => {
		rendererIpc.cancelEarCalibration();
		setCalibrating(false);
		resetCalibrationProgress();
		setCalibrationMessage(t("camera.calibrationCancelled"));
	}, [resetCalibrationProgress, t]);

	const resetCalibration = useCallback(() => {
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
	}, [setPreferences, t]);

	const dismissCalibrationNudge = useCallback(() => {
		setPreferences((current) => ({
			...current,
			calibrationNudgeDismissedAt: Date.now(),
		}));
		setLiveNudgeReason(null);
		rendererIpc.dismissCalibrationNudge();
	}, [setPreferences]);

	const progressRatio = calibrating
		? Math.min(1, calibrationElapsedMs / Math.max(1, calibrationDurationMs))
		: 0;
	const remainingSec = Math.max(
		0,
		Math.ceil((calibrationDurationMs - calibrationElapsedMs) / 1000),
	);
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

	return {
		calibrating,
		calibrationPhase,
		calibrationSampleCount,
		calibrationBlinkCount,
		calibrationFaceDetected,
		calibrationMessage,
		progressRatio,
		remainingSec,
		earBadge,
		lastCalibratedLabel,
		hasSavedCalibration,
		nudgeReason,
		startCalibration,
		cancelCalibration,
		resetCalibration,
		dismissCalibrationNudge,
	};
}

export type CameraCalibration = ReturnType<typeof useCameraCalibration>;
