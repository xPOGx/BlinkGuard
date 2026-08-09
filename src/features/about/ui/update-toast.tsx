import { useEffect } from "react";
import type { useAutoUpdate } from "@/features/about/model/use-auto-update";
import { useT } from "@/i18n";

type AutoUpdateApi = ReturnType<typeof useAutoUpdate>;

const AUTO_DISMISS_MS = 4000;

/** Ephemeral top toast for silent launch checks only (`surface: "toast"`). */
export function UpdateToast({ status, dismiss }: AutoUpdateApi) {
	const t = useT();
	const visible = status.state !== "idle" && status.surface === "toast";

	useEffect(() => {
		if (!visible) return;
		// Progress stays until the next status; terminal toasts fade out.
		if (
			status.state === "checking" ||
			status.state === "available" ||
			status.state === "downloading"
		) {
			return;
		}
		if (
			status.state !== "upToDate" &&
			status.state !== "error" &&
			status.state !== "ready"
		) {
			return;
		}
		const timer = window.setTimeout(() => dismiss(), AUTO_DISMISS_MS);
		return () => window.clearTimeout(timer);
	}, [status, visible, dismiss]);

	if (!visible) return null;

	const titleId = "auto-update-toast-title";
	let title = "";
	let message = "";
	let percent: number | null = null;

	switch (status.state) {
		case "checking":
			title = t("updates.checking.title");
			message = t("updates.checking.message");
			break;
		case "available":
			title = t("updates.available.title");
			message = t("updates.available.message", { version: status.version });
			break;
		case "downloading":
			title = t("updates.downloading.title");
			message = t("updates.downloading.message", {
				version: status.version,
				percent: status.percent,
			});
			percent = status.percent;
			break;
		case "upToDate":
			title = t("updates.upToDate.title");
			message = t("updates.upToDate.message");
			break;
		case "error":
			title = t("updates.error.title");
			message = t("updates.error.message");
			break;
		case "ready":
			title = t("updates.readyOnQuit.title");
			message = t("updates.readyOnQuit.message", { version: status.version });
			break;
		default:
			return null;
	}

	const showProgress =
		status.state === "downloading" || status.state === "available";
	const progressWidth = status.state === "downloading" ? (percent ?? 0) : 0;

	return (
		<div
			className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3"
			role="status"
			aria-live="polite"
			aria-labelledby={titleId}
		>
			<div className="pointer-events-auto flex w-full max-w-lg flex-col gap-2 rounded-lg border border-border bg-background/95 p-3 shadow-lg backdrop-blur-sm">
				<div className="min-w-0 space-y-0.5">
					<p
						id={titleId}
						className="text-sm font-semibold tracking-tight text-foreground"
					>
						{title}
					</p>
					<p className="select-text text-xs text-muted-foreground">{message}</p>
				</div>

				{showProgress ? (
					<div className="h-1 overflow-hidden rounded-full bg-muted">
						<div
							className="h-full bg-primary transition-[width] duration-200"
							style={{ width: `${progressWidth}%` }}
						/>
					</div>
				) : null}
			</div>
		</div>
	);
}
