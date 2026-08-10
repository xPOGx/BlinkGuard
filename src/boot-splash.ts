const MIN_VISIBLE_MS = 700;
const FADE_MS = 320;
const SAFETY_DISMISS_MS = 8_000;

let shownAt = 0;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let safetyTimer: ReturnType<typeof setTimeout> | null = null;
let dismissed = false;
let dismissRequested = false;
let armed = false;

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

/** Arm timers using the HTML paint timestamp when present. */
function armBootSplash(): void {
	if (armed || import.meta.env.MODE === "test") return;
	armed = true;
	const paintedAt = window.__bootSplashShownAt;
	shownAt =
		typeof paintedAt === "number" && Number.isFinite(paintedAt)
			? paintedAt
			: performance.now();
	safetyTimer = setTimeout(() => {
		void dismissBootSplash();
	}, SAFETY_DISMISS_MS);
}

/** Fade out and remove the boot splash once the settings shell is ready. */
export function dismissBootSplash(): Promise<void> {
	if (import.meta.env.MODE === "test" || dismissed || dismissRequested) {
		return Promise.resolve();
	}

	armBootSplash();

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
				splash.remove();
				dismissed = true;
				clearTimers();
				resolve();
			}, FADE_MS);
		}, wait);
	});
}

if (import.meta.env.MODE !== "test") {
	armBootSplash();
}
