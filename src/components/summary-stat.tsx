interface SummaryStatProps {
	label: string;
	value: string;
}

export function SummaryStat({ label, value }: SummaryStatProps) {
	return (
		<div className="rounded-md border border-border bg-background px-3 py-2">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
				{value}
			</p>
		</div>
	);
}
