import { screen, type Display } from "electron";
import type { Point, Size } from "../../../shared/preferences";

export type WorkArea = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export function getActiveDisplay(): Display {
	return screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
}

export function getAllWorkAreas(): WorkArea[] {
	return screen.getAllDisplays().map((display) => display.workArea);
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

/** Inclusive top/left, exclusive bottom/right — matches typical workArea hit-tests. */
export function isPointInAnyWorkArea(
	point: Point,
	workAreas: readonly WorkArea[],
): boolean {
	return workAreas.some(
		(area) =>
			point.x >= area.x &&
			point.y >= area.y &&
			point.x < area.x + area.width &&
			point.y < area.y + area.height,
	);
}

export function resolvePopupPosition(
	saved: Point | null,
	_popupSize: Size,
	workAreas: readonly WorkArea[],
	fallbackCenter: Point,
): { position: Point; recovered: boolean } {
	if (!saved) {
		return { position: fallbackCenter, recovered: false };
	}
	if (isPointInAnyWorkArea(saved, workAreas)) {
		return { position: saved, recovered: false };
	}
	return { position: fallbackCenter, recovered: true };
}

/** Resolve saved position against live displays; recover to active-display center. */
export function resolveVisiblePopupPosition(
	saved: Point | null,
	popupSize: Size,
): { position: Point; recovered: boolean } {
	return resolvePopupPosition(
		saved,
		popupSize,
		getAllWorkAreas(),
		getCenteredPopupPosition(popupSize.width, popupSize.height),
	);
}
