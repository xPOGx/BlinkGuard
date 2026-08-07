interface EyeCareDisabledNoticeProps {
	eyeExercisesEnabled: boolean;
	lookAwayEnabled: boolean;
}

export function EyeCareDisabledNotice({
	eyeExercisesEnabled,
	lookAwayEnabled,
}: EyeCareDisabledNoticeProps) {
	if (eyeExercisesEnabled || lookAwayEnabled) return null;

	return (
		<aside
			role="status"
			className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-100"
		>
			<h3 className="mb-1 text-sm font-semibold">Eye strain risk</h3>
			<p className="text-sm opacity-90">
				Eye exercises and 20-20-20 look-away breaks are both turned off.
				Long screen sessions without breaks can contribute to digital eye
				strain — consider enabling at least one reminder.
			</p>
		</aside>
	);
}
