import { useEffect, useState } from "react";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type { CameraCaptureSurface } from "../../../../shared/camera-capture-status";

export function useCameraStatus() {
	const [error, setError] = useState<string | null>(null);
	const [isWindowOpen, setIsWindowOpen] = useState(false);
	const [captureSurface, setCaptureSurface] =
		useState<CameraCaptureSurface>("idle");

	useEffect(() => {
		const unsubscribeError = rendererIpc.onCameraError((cameraError) => {
			console.error("Camera error:", cameraError);
			setError(cameraError);
		});
		const unsubscribeReady = rendererIpc.onCameraReady(() => {
			setError(null);
		});
		const unsubscribeCapture = rendererIpc.onCameraCaptureStatus((payload) => {
			setCaptureSurface(payload.surface);
			if (payload.capturing) setError(null);
		});
		const unsubscribeClosed = rendererIpc.onCameraWindowClosed(() =>
			setIsWindowOpen(false),
		);
		// Cold start / Strict Mode remount can miss the live push while lastPayload
		// already matches — request a forced snapshot after the listener attaches.
		rendererIpc.requestCameraCaptureStatus();
		return () => {
			unsubscribeError();
			unsubscribeReady();
			unsubscribeCapture();
			unsubscribeClosed();
		};
	}, []);

	return {
		error,
		setError,
		isWindowOpen,
		setIsWindowOpen,
		captureSurface,
	};
}
