import { useState } from "react";
import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/features/settings/ui/setting-panel";
import { cn } from "@/lib/utils";
import {
	type BlinkStatsSnapshot,
	formatTrackingDuration,
} from "../../../../shared/blink-stats";
import { useBlinkStats } from "../model/use-blink-stats";
import { StatsBarChart } from "./stats-bar-chart";

type ChartRange = "today" | "week" | "month" | "year";

const CHART_COPY: Record<
	ChartRange,
	{ description: string; ariaLabel: string }
> = {
	today: {
		description: "Blinks per hour for today.",
		ariaLabel: "Blinks per hour today",
	},
	week: {
		description: "Blinks per day this week (Пн–Нд).",
		ariaLabel: "Blinks per day Monday through Sunday",
	},
	month: {
		description: "Blinks per day this calendar month.",
		ariaLabel: "Blinks per day this month",
	},
	year: {
		description: "Blinks per month this year (Січ–Гру).",
		ariaLabel: "Blinks per month January through December",
	},
};

function chartBuckets(range: ChartRange, snapshot: BlinkStatsSnapshot) {
	switch (range) {
		case "today":
			return snapshot.dayChart;
		case "week":
			return snapshot.weekChart;
		case "month":
			return snapshot.monthChart;
		case "year":
			return snapshot.yearChart;
	}
}

export function StatisticsPanel() {
	const { snapshot, clearStatistics } = useBlinkStats();
	const [range, setRange] = useState<ChartRange>("today");
	const { today, totals } = snapshot;
	const buckets = chartBuckets(range, snapshot);

	return (
		<>
			<SettingPanel>
				<SettingRow
					title="Totals"
					description="Lifetime credited blinks. Available balance is reserved for future rewards."
				>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<SummaryStat label="Total" value={String(totals.total)} />
						<SummaryStat label="Available" value={String(totals.available)} />
						<SummaryStat label="Spent" value={String(totals.spent)} />
					</div>
					<p className="mt-3 text-xs text-muted-foreground">
						Spending is not enabled yet — balance is tracked so rewards can
						deduct from Available later.
					</p>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title="Today"
					description="Credited blinks, tracking time, and start/stop sessions for the local day."
				>
					<div className="grid grid-cols-3 gap-3">
						<SummaryStat label="Blinks" value={String(today.blinks)} />
						<SummaryStat
							label="Tracking"
							value={formatTrackingDuration(today.trackingMs)}
						/>
						<SummaryStat label="Sessions" value={String(today.sessions)} />
					</div>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm font-medium text-foreground">Blink chart</p>
						<p className="text-xs text-muted-foreground sm:text-sm">
							{CHART_COPY[range].description}
						</p>
					</div>
					<div className="inline-flex shrink-0 flex-wrap rounded-md border border-border p-0.5">
						{(
							[
								["today", "Today"],
								["week", "Week"],
								["month", "Month"],
								["year", "Year"],
							] as const
						).map(([id, label]) => (
							<RangeButton
								key={id}
								active={range === id}
								onClick={() => setRange(id)}
							>
								{label}
							</RangeButton>
						))}
					</div>
				</div>
				<StatsBarChart
					buckets={buckets}
					ariaLabel={CHART_COPY[range].ariaLabel}
				/>
			</SettingPanel>

			<SettingPanel className="flex items-center justify-center">
				<Button type="button" variant="destructive" onClick={clearStatistics}>
					Clear statistics
				</Button>
			</SettingPanel>
		</>
	);
}

function SummaryStat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-border bg-background px-3 py-2">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight">
				{value}
			</p>
		</div>
	);
}

function RangeButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"rounded px-2.5 py-1 text-xs font-medium transition-colors",
				active
					? "bg-primary text-primary-foreground"
					: "text-muted-foreground hover:text-foreground",
			)}
		>
			{children}
		</button>
	);
}
