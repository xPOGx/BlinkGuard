import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n, useT } from "@/i18n";
import { cn } from "@/lib/utils";
import {
	BLINK_RATE_WINDOW_MS,
	type BlinkRateQuality,
	classifyBlinkRate,
	formatBlinksPerMinute,
} from "../../../../shared/blink-rate";

const METER_CAP = 20;
const TREND_HOLD_MS = 450;
const VALUE_TWEEN_MS = 550;

type Trend = "up" | "down" | null;

type LiveBlinkRateProps = {
	blinksPerMinute: number;
	blinkRateReady: boolean;
	blinkRateWarmupMs: number;
};

export function LiveBlinkRate({
	blinksPerMinute,
	blinkRateReady,
	blinkRateWarmupMs,
}: LiveBlinkRateProps) {
	const t = useT();
	const { locale } = useI18n();
	const previousTargetRef = useRef(blinksPerMinute);
	const [trend, setTrend] = useState<Trend>(null);
	const warming = !blinkRateReady;
	const animatedBpm = useAnimatedNumber(
		warming ? 0 : blinksPerMinute,
		!warming,
		VALUE_TWEEN_MS,
	);
	const guidance = classifyBlinkRate(animatedBpm, locale);
	const targetGuidance = classifyBlinkRate(blinksPerMinute, locale);
	const display = formatBlinksPerMinute(animatedBpm);
	const idle = blinkRateReady && blinksPerMinute <= 0 && animatedBpm < 0.05;
	const warmupPct = Math.min(
		100,
		(blinkRateWarmupMs / BLINK_RATE_WINDOW_MS) * 100,
	);
	const meterPct = warming
		? warmupPct
		: Math.min(100, (animatedBpm / METER_CAP) * 100);
	const remainingSec = Math.max(
		0,
		Math.ceil((BLINK_RATE_WINDOW_MS - blinkRateWarmupMs) / 1000),
	);

	useEffect(() => {
		if (warming) {
			previousTargetRef.current = blinksPerMinute;
			setTrend(null);
			return;
		}
		const previous = previousTargetRef.current;
		previousTargetRef.current = blinksPerMinute;
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
	}, [blinksPerMinute, warming]);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-end justify-between gap-3">
				<div className="min-w-0">
					<p className="flex items-center gap-1.5 text-xs text-muted-foreground">
						<Activity className="h-3.5 w-3.5" aria-hidden />
						{t("rate.current")}
					</p>
					<div className="mt-1 flex items-baseline gap-2">
						<p
							className={cn(
								"text-3xl font-semibold tabular-nums tracking-tight transition-[color,transform] duration-500 ease-out",
								warming || idle
									? "text-muted-foreground"
									: qualityValueClass(guidance.quality),
								!warming && trend === "up" && "-translate-y-0.5 scale-105",
								!warming && trend === "down" && "translate-y-0.5 scale-95",
							)}
							aria-live="polite"
							aria-atomic="true"
						>
							<span className="inline-block min-w-[2.5ch] text-left">
								{warming ? "—" : display}
							</span>
							<span className="ml-1 text-base font-medium text-muted-foreground">
								{t("rate.perMin")}
							</span>
						</p>
						<span
							className={cn(
								"inline-flex h-4 w-4 items-center justify-center transition-opacity duration-300",
								trend ? "opacity-100" : "opacity-0",
							)}
							aria-hidden={!trend}
						>
							{trend === "up" ? (
								<TrendingUp
									className="h-4 w-4 text-primary"
									aria-label={t("rate.rising")}
								/>
							) : (
								<TrendingDown
									className="h-4 w-4 text-muted-foreground"
									aria-label={t("rate.falling")}
								/>
							)}
						</span>
					</div>
				</div>
				<span
					className={cn(
						"shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-500 ease-out",
						warming || idle
							? "bg-muted text-muted-foreground"
							: qualityBadgeClass(targetGuidance.quality),
					)}
				>
					{warming ? t("rate.warmingUp") : idle ? "—" : targetGuidance.label}
				</span>
			</div>

			<div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
				<div
					className={cn(
						"h-full rounded-full transition-[background-color] duration-500 ease-out",
						warming
							? "bg-muted-foreground/40"
							: idle
								? "bg-muted-foreground/30"
								: meterBarClass(guidance.quality),
					)}
					style={{
						width: `${meterPct}%`,
						transition: warming
							? "width 500ms ease-out, background-color 500ms ease-out"
							: "background-color 500ms ease-out",
					}}
				/>
			</div>

			<p
				className={cn(
					"text-xs text-muted-foreground transition-opacity duration-300 sm:text-sm",
				)}
			>
				{warming
					? blinkRateWarmupMs > 0
						? t("rate.collecting", { n: remainingSec })
						: t("rate.startTracking")
					: idle
						? t("rate.waiting")
						: targetGuidance.description}
			</p>
		</div>
	);
}

/** Ease-out cubic tween between successive BPM targets (no extra deps). */
function useAnimatedNumber(
	target: number,
	enabled: boolean,
	durationMs: number,
): number {
	const [value, setValue] = useState(target);
	const valueRef = useRef(target);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (!enabled) {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			valueRef.current = target;
			setValue(target);
			return;
		}

		const from = valueRef.current;
		const to = target;
		if (Math.abs(from - to) < 0.001) {
			valueRef.current = to;
			setValue(to);
			return;
		}

		const start = performance.now();
		const tick = (now: number) => {
			const t = Math.min(1, (now - start) / durationMs);
			const eased = 1 - (1 - t) ** 3;
			const next = from + (to - from) * eased;
			valueRef.current = next;
			setValue(next);
			if (t < 1) {
				rafRef.current = requestAnimationFrame(tick);
			} else {
				rafRef.current = null;
				valueRef.current = to;
				setValue(to);
			}
		};

		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [target, enabled, durationMs]);

	return value;
}

function qualityValueClass(quality: BlinkRateQuality): string {
	switch (quality) {
		case "low":
			return "text-destructive";
		case "ok":
			return "text-foreground";
		case "good":
			return "text-primary";
	}
}

function qualityBadgeClass(quality: BlinkRateQuality): string {
	switch (quality) {
		case "low":
			return "bg-destructive/15 text-destructive";
		case "ok":
			return "bg-accent text-accent-foreground";
		case "good":
			return "bg-primary/15 text-primary";
	}
}

function meterBarClass(quality: BlinkRateQuality): string {
	switch (quality) {
		case "low":
			return "bg-destructive";
		case "ok":
			return "bg-foreground/70";
		case "good":
			return "bg-primary";
	}
}
