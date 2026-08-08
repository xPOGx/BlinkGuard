import lottieWeb, { type AnimationItem } from "lottie-web/build/player/lottie_light";
import { useEffect, useRef } from "react";
import eyeAnimation from "@/assets/eye.json";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";

type LottiePlayer = {
	loadAnimation: typeof lottieWeb.loadAnimation;
};

const lottiePlayer = (
	"loadAnimation" in lottieWeb
		? lottieWeb
		: (lottieWeb as unknown as { default: LottiePlayer }).default
) as LottiePlayer;

/** Fully open eye keyframes (blinks close at 4 / 24 / 51). */
const OPEN_EYE_FRAMES = [0, 8, 20, 28, 47] as const;
const IDLE_EYE_FRAME = OPEN_EYE_FRAMES[0];

interface TrackingEyeButtonProps {
	isTracking: boolean;
	onToggle: () => void;
}

function openFrameTarget(current: number): {
	frame: number;
	forward: boolean;
} {
	const next = OPEN_EYE_FRAMES.find((frame) => frame > current + 0.25);
	if (next != null) return { frame: next, forward: true };

	const previous = [...OPEN_EYE_FRAMES]
		.reverse()
		.find((frame) => frame < current - 0.25);
	if (previous != null) return { frame: previous, forward: false };

	return { frame: IDLE_EYE_FRAME, forward: true };
}

function clearSettleListener(
	anim: AnimationItem,
	settleRef: { current: (() => void) | null },
) {
	if (!settleRef.current) return;
	anim.removeEventListener("complete", settleRef.current);
	settleRef.current = null;
}

function settleOnOpen(anim: AnimationItem, frame: number) {
	anim.loop = false;
	anim.setDirection(1);
	anim.resetSegments(true);
	anim.goToAndStop(frame, true);
}

export function TrackingEyeButton({
	isTracking,
	onToggle,
}: TrackingEyeButtonProps) {
	const t = useT();
	const containerRef = useRef<HTMLSpanElement>(null);
	const animRef = useRef<AnimationItem | null>(null);
	const settleRef = useRef<(() => void) | null>(null);
	const wasTrackingRef = useRef(false);
	const trackingLabel = isTracking ? t("tracking.stop") : t("tracking.start");

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const anim = lottiePlayer.loadAnimation({
			container,
			renderer: "svg",
			loop: true,
			autoplay: false,
			animationData: structuredClone(eyeAnimation),
		});
		animRef.current = anim;
		settleOnOpen(anim, IDLE_EYE_FRAME);

		return () => {
			clearSettleListener(anim, settleRef);
			anim.destroy();
			animRef.current = null;
		};
	}, []);

	useEffect(() => {
		const anim = animRef.current;
		if (!anim) return;

		clearSettleListener(anim, settleRef);

		if (isTracking) {
			const resumeFrame = anim.currentFrame;
			wasTrackingRef.current = true;
			anim.loop = true;
			anim.setDirection(1);
			anim.resetSegments(true);
			anim.setSpeed(1);
			anim.goToAndPlay(resumeFrame, true);
			return;
		}

		if (!wasTrackingRef.current) {
			settleOnOpen(anim, IDLE_EYE_FRAME);
			return;
		}

		wasTrackingRef.current = false;
		const current = anim.currentFrame;
		const { frame: target, forward } = openFrameTarget(current);

		if (Math.abs(current - target) < 0.5) {
			settleOnOpen(anim, target);
			return;
		}

		const settle = () => {
			clearSettleListener(anim, settleRef);
			settleOnOpen(anim, target);
		};
		settleRef.current = settle;
		anim.addEventListener("complete", settle);
		anim.loop = false;
		anim.setDirection(forward ? 1 : -1);
		anim.playSegments(
			forward ? [Math.floor(current), target] : [target, Math.ceil(current)],
			true,
		);
	}, [isTracking]);

	return (
		<button
			type="button"
			onClick={onToggle}
			aria-pressed={isTracking}
			aria-label={trackingLabel}
			title={trackingLabel}
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
			<span
				ref={containerRef}
				aria-hidden
				className="relative z-10 pointer-events-none h-7 w-7 [&>svg]:h-full [&>svg]:w-full"
			/>
		</button>
	);
}
