import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { useEffect, useState } from "react";

export function useCameraStatus() {
	const [error, setError] = useState<string | null>(null);
	const [isWindowOpen, setIsWindowOpen] = useState(false);

	useEffect(() => {
		const unsubscribeError = rendererIpc.onCameraError((cameraError) => {
			console.error("Camera error:", cameraError);
			setError(cameraError);
		});
		const unsubscribeReady = rendererIpc.onCameraReady(() => {
			setError(null);
		});
		const unsubscribeClosed = rendererIpc.onCameraWindowClosed(() =>
			setIsWindowOpen(false),
		);
		return () => {
			unsubscribeError();
			unsubscribeReady();
			unsubscribeClosed();
		};
	}, []);

	return { error, setError, isWindowOpen, setIsWindowOpen };
}
