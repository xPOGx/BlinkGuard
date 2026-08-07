import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
	type BlinkRateQuality,
	classifyBlinkRate,
	formatBlinksPerMinute,
} from "../../../../shared/blink-rate";

const METER_CAP = 20;
const TREND_HOLD_MS = 400;

type Trend = "up" | "down" | null;

type LiveBlinkRateProps = {
	blinksPerMinute: number;
};

export function LiveBlinkRate({ blinksPerMinute }: LiveBlinkRateProps) {
	const previousRef = useRef(blinksPerMinute);
	const [trend, setTrend] = useState<Trend>(null);
	const guidance = classifyBlinkRate(blinksPerMinute);
	const display = formatBlinksPerMinute(blinksPerMinute);
	const idle = blinksPerMinute <= 0;
	const meterPct = Math.min(100, (blinksPerMinute / METER_CAP) * 100);

	useEffect(() => {
		const previous = previousRef.current;
		previousRef.current = blinksPerMinute;
		if (blinksPerMinute === previous) return;

		const nextTrend: Trend =
			blinksPerMinute > previous
				? "up"
				: blinksPerMinute < previous
					? "down"
					: null;
		if (!nextTrend) return;

		setTrend(nextTrend);
		const timeout = window.setTimeout(() => setTrend(null), TREND_HOLD_MS);
		return () => window.clearTimeout(timeout);
	}, [blinksPerMinute]);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-end justify-between gap-3">
				<div className="min-w-0">
					<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Activity className="h-3.5 w-3.5" aria-hidden />
						Current rate
					</p>
					<div className="mt-1 flex items-baseline gap-2">
						<p
							className={cn(
								"text-3xl font-semibold tabular-nums tracking-tight transition-[color,transform] duration-300",
								qualityValueClass(guidance.quality, idle),
								trend === "up" && "-translate-y-0.5 scale-105",
								trend === "down" && "translate-y-0.5 scale-95",
							)}
							aria-live="polite"
						>
							{display}
							<span className="ml-1 text-base font-medium text-muted-foreground">
								/min
							</span>
						</p>
						{trend === "up" ? (
							<TrendingUp
								className="h-4 w-4 text-primary transition-opacity"
								aria-label="Rate rising"
							/>
						) : null}
						{trend === "down" ? (
							<TrendingDown
								className="h-4 w-4 text-muted-foreground transition-opacity"
								aria-label="Rate falling"
							/>
						) : null}
					</div>
				</div>
				<span
					className={cn(
						"shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-300",
						qualityBadgeClass(guidance.quality, idle),
					)}
				>
					{idle ? "—" : guidance.label}
				</span>
			</div>

			<div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
				<div
					className={cn(
						"h-full rounded-full transition-[width,background-color] duration-500 ease-out",
						meterBarClass(guidance.quality, idle),
					)}
					style={{ width: `${meterPct}%` }}
				/>
			</div>

			<p className="text-xs text-muted-foreground sm:text-sm">
				{idle ? "Waiting for credited blinks…" : guidance.description}
			</p>
		</div>
	);
}

function qualityValueClass(quality: BlinkRateQuality, idle: boolean): string {
	if (idle) return "text-muted-foreground";
	switch (quality) {
		case "low":
			return "text-destructive";
		case "ok":
			return "text-foreground";
		case "good":
			return "text-primary";
	}
}

function qualityBadgeClass(quality: BlinkRateQuality, idle: boolean): string {
	if (idle) return "bg-muted text-muted-foreground";
	switch (quality) {
		case "low":
			return "bg-destructive/15 text-destructive";
		case "ok":
			return "bg-accent text-accent-foreground";
		case "good":
			return "bg-primary/15 text-primary";
	}
}

function meterBarClass(quality: BlinkRateQuality, idle: boolean): string {
	if (idle) return "bg-muted-foreground/30";
	switch (quality) {
		case "low":
			return "bg-destructive";
		case "ok":
			return "bg-foreground/70";
		case "good":
			return "bg-primary";
	}
}
