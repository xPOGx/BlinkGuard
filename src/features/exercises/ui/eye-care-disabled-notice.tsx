import { useT } from "@/i18n";

interface EyeCareDisabledNoticeProps {
	eyeExercisesEnabled: boolean;
	lookAwayEnabled: boolean;
}

export function EyeCareDisabledNotice({
	eyeExercisesEnabled,
	lookAwayEnabled,
}: EyeCareDisabledNoticeProps) {
	const t = useT();
	if (eyeExercisesEnabled || lookAwayEnabled) return null;

	return (
		<aside
			role="status"
			className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100"
		>
			<h3 className="mb-1 text-sm font-semibold">
				{t("exercises.disabledNotice.title")}
			</h3>
			<p className="text-sm opacity-90">{t("exercises.disabledNotice.body")}</p>
		</aside>
	);
}
