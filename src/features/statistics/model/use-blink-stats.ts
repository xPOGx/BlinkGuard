import { useEffect, useState } from "react";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import {
	type BlinkStatsSnapshot,
	DEFAULT_BLINK_STATS,
	toBlinkStatsSnapshot,
} from "../../../../shared/blink-stats";

const emptySnapshot = (): BlinkStatsSnapshot =>
	toBlinkStatsSnapshot(DEFAULT_BLINK_STATS);

export function useBlinkStats() {
	const [snapshot, setSnapshot] = useState<BlinkStatsSnapshot>(emptySnapshot);

	useEffect(() => {
		const unsubscribe = rendererIpc.onBlinkStats(setSnapshot);
		rendererIpc.subscribeBlinkStats();
		return () => {
			unsubscribe();
			rendererIpc.unsubscribeBlinkStats();
		};
	}, []);

	const clearStatistics = () => {
		if (
			window.confirm(
				"Clear all blink and session statistics? This cannot be undone.",
			)
		) {
			rendererIpc.resetBlinkStats();
		}
	};

	return { snapshot, clearStatistics };
}
