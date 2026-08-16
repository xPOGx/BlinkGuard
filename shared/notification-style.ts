/** How interruptive blink / exercise / look-away prompts are presented. */
export type NotificationStyle = "overlay" | "native" | "both";

export const NOTIFICATION_STYLE_VALUES = [
	"overlay",
	"native",
	"both",
] as const satisfies readonly NotificationStyle[];

export const DEFAULT_NOTIFICATION_STYLE: NotificationStyle = "overlay";

export type PromptSurfaces = {
	overlay: boolean;
	native: boolean;
};

export function isNotificationStyleValue(
	value: unknown,
): value is NotificationStyle {
	return (
		value === "overlay" || value === "native" || value === "both"
	);
}

export function sanitizeNotificationStyle(value: unknown): NotificationStyle {
	return isNotificationStyleValue(value)
		? value
		: DEFAULT_NOTIFICATION_STYLE;
}

export function notificationSurfaces(style: NotificationStyle): PromptSurfaces {
	return {
		overlay: style === "overlay" || style === "both",
		native: style === "native" || style === "both",
	};
}

/**
 * If native toasts were requested but cannot be used, fall back to overlay
 * so `"native"` never silently drops a prompt.
 */
export function resolvePromptSurfaces(
	style: NotificationStyle,
	nativeUsable: boolean,
): PromptSurfaces {
	const surfaces = notificationSurfaces(style);
	if (surfaces.native && !nativeUsable) {
		return { overlay: true, native: false };
	}
	return surfaces;
}

/** After a native `show` attempt: overlay if requested or native failed. */
export function withNativeFallback(
	surfaces: PromptSurfaces,
	nativeShown: boolean,
): { overlay: boolean; nativeShown: boolean } {
	return {
		overlay: surfaces.overlay || (surfaces.native && !nativeShown),
		nativeShown: surfaces.native && nativeShown,
	};
}
