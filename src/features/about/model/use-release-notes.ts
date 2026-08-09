import { useEffect, useState } from "react";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import type {
	GetReleaseNotesResult,
	ReleaseNotesEntry,
} from "../../../../shared/release-notes";

export type ReleaseNotesState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ok"; releases: ReleaseNotesEntry[] }
	| { status: "error"; message: string };

export function useReleaseNotes(enabled: boolean): ReleaseNotesState {
	const [state, setState] = useState<ReleaseNotesState>({ status: "idle" });

	useEffect(() => {
		if (!enabled) {
			setState({ status: "idle" });
			return;
		}

		let cancelled = false;
		setState({ status: "loading" });

		void (async () => {
			const result: GetReleaseNotesResult = await rendererIpc.getReleaseNotes();
			if (cancelled) return;
			if (result.status === "ok") {
				setState({ status: "ok", releases: result.releases });
			} else {
				setState({ status: "error", message: result.message });
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [enabled]);

	return state;
}
