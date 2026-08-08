import { useState } from "react";
import { Button } from "@/components/button";
import { SettingPanel, SettingRow } from "@/components/setting-panel";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import {
	type BlinkStatsSnapshot,
	formatTrackingDuration,
} from "../../../../shared/blink-stats";
import { useBlinkStats } from "../model/use-blink-stats";
import { LiveBlinkRate } from "./live-blink-rate";
import { StatsBarChart } from "./stats-bar-chart";

type ChartRange = "today" | "week" | "month" | "year";

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
	const { t, locale } = useI18n();
	const { snapshot, clearStatistics } = useBlinkStats();
	const [range, setRange] = useState<ChartRange>("today");
	const { today, totals } = snapshot;
	const buckets = chartBuckets(range, snapshot);
	const chartCopy: Record<
		ChartRange,
		{ description: string; ariaLabel: string }
	> = {
		today: {
			description: t("stats.chart.today.desc"),
			ariaLabel: t("stats.chart.today.aria"),
		},
		week: {
			description: t("stats.chart.week.desc"),
			ariaLabel: t("stats.chart.week.aria"),
		},
		month: {
			description: t("stats.chart.month.desc"),
			ariaLabel: t("stats.chart.month.aria"),
		},
		year: {
			description: t("stats.chart.year.desc"),
			ariaLabel: t("stats.chart.year.aria"),
		},
	};

	return (
		<>
			<SettingPanel>
				<SettingRow
					title={t("stats.totals")}
					description={t("stats.totalsDesc")}
				>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						<SummaryStat
							label={t("stats.total")}
							value={String(totals.total)}
						/>
						<SummaryStat
							label={t("stats.available")}
							value={String(totals.available)}
						/>
						<SummaryStat
							label={t("stats.spent")}
							value={String(totals.spent)}
						/>
					</div>
					<p className="mt-3 text-xs text-muted-foreground">
						{t("stats.spendingNote")}
					</p>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow
					title={t("stats.liveRate")}
					description={t("stats.liveRateDesc")}
				>
					<LiveBlinkRate
						blinksPerMinute={snapshot.blinksPerMinute}
						blinkRateReady={snapshot.blinkRateReady}
						blinkRateWarmupMs={snapshot.blinkRateWarmupMs}
					/>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<SettingRow title={t("stats.today")} description={t("stats.todayDesc")}>
					<div className="grid grid-cols-3 gap-3">
						<SummaryStat
							label={t("stats.blinks")}
							value={String(today.blinks)}
						/>
						<SummaryStat
							label={t("stats.tracking")}
							value={formatTrackingDuration(today.trackingMs, locale)}
						/>
						<SummaryStat
							label={t("stats.sessions")}
							value={String(today.sessions)}
						/>
					</div>
				</SettingRow>
			</SettingPanel>

			<SettingPanel>
				<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<p className="text-sm font-medium text-foreground">
							{t("stats.chart")}
						</p>
						<p className="text-xs text-muted-foreground sm:text-sm">
							{chartCopy[range].description}
						</p>
					</div>
					<div className="inline-flex shrink-0 flex-wrap rounded-md border border-border p-0.5">
						{(
							[
								["today", t("stats.today")],
								["week", t("stats.week")],
								["month", t("stats.month")],
								["year", t("stats.year")],
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
					ariaLabel={chartCopy[range].ariaLabel}
				/>
			</SettingPanel>

			<SettingPanel className="flex items-center justify-center">
				<Button type="button" variant="destructive" onClick={clearStatistics}>
					{t("stats.clear")}
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
