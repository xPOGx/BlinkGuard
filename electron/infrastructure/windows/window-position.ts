import { screen } from "electron";

export function getCenteredPopupPosition(
	popupWidth: number,
	popupHeight: number,
) {
	const display = screen.getPrimaryDisplay();
	const { width, height } = display.workAreaSize;
	return {
		x: Math.floor((width - popupWidth) / 2),
		y: Math.floor((height - popupHeight) / 2),
	};
}

export function getTopCenterPopupPosition(popupWidth: number) {
	const display = screen.getPrimaryDisplay();
	const { x, y, width } = display.workArea;
	return {
		x: Math.floor(x + (width - popupWidth) / 2),
		y: Math.floor(y + 4),
	};
}
