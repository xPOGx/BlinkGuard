import lottieWeb, { type AnimationItem } from "lottie-web";
import eyeAnimation from "@/assets/eye.json";

type LottiePlayer = {
	loadAnimation: typeof lottieWeb.loadAnimation;
};

const lottiePlayer = (
	"loadAnimation" in lottieWeb
		? lottieWeb
		: (lottieWeb as unknown as { default: LottiePlayer }).default
) as LottiePlayer;

const MIN_VISIBLE_MS = 700;
const FADE_MS = 320;
const SAFETY_DISMISS_MS = 8_000;

let animation: AnimationItem | null = null;
let shownAt = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
let dismissed = false;
let dismissRequested = false;

function splashElement(): HTMLElement | null {
	return document.getElementById("boot-splash");
}

function clearTimers(): void {
	if (dismissTimer) {
		clearTimeout(dismissTimer);
		dismissTimer = null;
	}
	if (safetyTimer) {
		clearTimeout(safetyTimer);
		safetyTimer = null;
	}
}

/** Mount the eye Lottie into the HTML boot splash as early as the renderer loads. */
export function mountBootSplash(): void {
	if (import.meta.env.MODE === "test") return;

	const container = document.getElementById("boot-splash-lottie");
	const splash = splashElement();
	if (!container || !splash || animation) return;

	shownAt = performance.now();
	animation = lottiePlayer.loadAnimation({
		container,
		renderer: "svg",
		loop: true,
		autoplay: true,
		animationData: structuredClone(eyeAnimation),
	});
	animation.setSpeed(1.15);

	safetyTimer = setTimeout(() => {
		void dismissBootSplash();
	}, SAFETY_DISMISS_MS);
}

/** Fade out and remove the boot splash once the settings shell is ready. */
export function dismissBootSplash(): Promise<void> {
	if (import.meta.env.MODE === "test" || dismissed || dismissRequested) {
		return Promise.resolve();
	}

	const splash = splashElement();
	if (!splash) {
		dismissed = true;
		clearTimers();
		return Promise.resolve();
	}

	dismissRequested = true;
	const elapsed = performance.now() - shownAt;
	const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);

	return new Promise((resolve) => {
		dismissTimer = setTimeout(() => {
			dismissTimer = null;
			splash.classList.add("boot-splash--hide");
			window.setTimeout(() => {
				animation?.destroy();
				animation = null;
				splash.remove();
				dismissed = true;
				clearTimers();
				resolve();
			}, FADE_MS);
		}, wait);
	});
}
