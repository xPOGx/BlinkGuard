import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { useEffect, useRef, useState } from "react";

export function useCameraStatus() {
	const [error, setError] = useState<string | null>(null);
	const [isWindowOpen, setIsWindowOpen] = useState(false);
	const errorTimeout = useRef<ReturnType<typeof setTimeout>>();

	useEffect(() => {
		const unsubscribeError = rendererIpc.onCameraError((cameraError) => {
			console.error("Camera error:", cameraError);
			setError(cameraError);
			clearTimeout(errorTimeout.current);
			errorTimeout.current = setTimeout(() => setError(null), 10000);
		});
		const unsubscribeClosed = rendererIpc.onCameraWindowClosed(() =>
			setIsWindowOpen(false),
		);
		return () => {
			unsubscribeError();
			unsubscribeClosed();
			clearTimeout(errorTimeout.current);
		};
	}, []);

	return { error, setError, isWindowOpen, setIsWindowOpen };
}
