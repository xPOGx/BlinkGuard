import { useCallback, useEffect, useState } from "react";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type { AutoUpdateStatus } from "../../../../shared/auto-update";

const idleStatus: AutoUpdateStatus = { state: "idle" };

export function useAutoUpdate() {
	const [status, setStatus] = useState<AutoUpdateStatus>(idleStatus);

	useEffect(() => {
		return rendererIpc.onAutoUpdateStatus((next) => {
			setStatus(next);
		});
	}, []);

	const dismiss = useCallback(() => {
		setStatus(idleStatus);
	}, []);

	const busy =
		status.state === "checking" ||
		status.state === "available" ||
		status.state === "downloading";

	return {
		status,
		busy,
		check: () => rendererIpc.checkForUpdates(),
		install: () => rendererIpc.installUpdate(),
		dismiss,
	};
}
