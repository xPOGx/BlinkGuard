import lottieReact from "lottie-react";
import { useEffect } from "react";
import eyeAnimation from "@/assets/eye.json";
import { cn } from "@/lib/utils";

/** Vite CJS interop: prebundle exports the module namespace as default. */
const { useLottie } = (
	"useLottie" in lottieReact
		? lottieReact
		: (lottieReact as unknown as { default: typeof lottieReact }).default
) as typeof import("lottie-react");

/** Fully open eye keyframe (blinks close at 4 / 24 / 51). */
const IDLE_EYE_FRAME = 0;

interface TrackingEyeButtonProps {
	isTracking: boolean;
	onToggle: () => void;
}

export function TrackingEyeButton({
	isTracking,
	onToggle,
}: TrackingEyeButtonProps) {
	const { View, goToAndPlay, goToAndStop, setSpeed, animationLoaded } =
		useLottie({
			animationData: eyeAnimation,
			loop: true,
			autoplay: false,
			style: { width: 28, height: 28, pointerEvents: "none" },
		});

	useEffect(() => {
		if (!animationLoaded) return;

		if (isTracking) {
			setSpeed(1);
			goToAndPlay(0, true);
			return;
		}

		goToAndStop(IDLE_EYE_FRAME, true);
	}, [animationLoaded, goToAndPlay, goToAndStop, isTracking, setSpeed]);

	return (
		<button
			type="button"
			onClick={onToggle}
			aria-pressed={isTracking}
			aria-label={isTracking ? "Stop reminders" : "Start reminders"}
			title={isTracking ? "Stop reminders" : "Start reminders"}
			className={cn(
				"relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors",
				"focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
				isTracking
					? "shadow-[0_0_0_3px_hsl(var(--primary)/0.25)]"
					: "bg-primary/70 hover:bg-primary",
			)}
		>
			{isTracking ? (
				<span
					aria-hidden
					className="pointer-events-none absolute inset-0 z-0 animate-tracking-pulse rounded-lg bg-primary/40"
				/>
			) : null}
			<span aria-hidden className="relative z-10 pointer-events-none">
				{View}
			</span>
		</button>
	);
}
