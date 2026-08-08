import { screen, type Display } from "electron";

export function getActiveDisplay(): Display {
	return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

export function getCenteredPopupPosition(
	popupWidth: number,
	popupHeight: number,
) {
	const { x, y, width, height } = getActiveDisplay().workArea;
	return {
		x: Math.floor(x + (width - popupWidth) / 2),
		y: Math.floor(y + (height - popupHeight) / 2),
	};
}

/** Vertically centered, horizontally in the right third of the work area. */
export function getRightBiasedPopupPosition(
	popupWidth: number,
	popupHeight: number,
) {
	const { x, y, width, height } = getActiveDisplay().workArea;
	return {
		x: Math.floor(x + (width - popupWidth) * 0.72),
		y: Math.floor(y + (height - popupHeight) / 2),
	};
}

/** Vertically centered, horizontally in the left third of the work area. */
export function getLeftBiasedPopupPosition(
	popupWidth: number,
	popupHeight: number,
) {
	const { x, y, width, height } = getActiveDisplay().workArea;
	return {
		x: Math.floor(x + (width - popupWidth) * 0.28),
		y: Math.floor(y + (height - popupHeight) / 2),
	};
}

export function getTopCenterPopupPosition(popupWidth: number) {
	const { x, y, width } = getActiveDisplay().workArea;
	return {
		x: Math.floor(x + (width - popupWidth) / 2),
		y: Math.floor(y + 4),
	};
}
