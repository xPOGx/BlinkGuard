import { beforeEach, describe, expect, it, vi } from "vitest";

const getCursorScreenPoint = vi.fn();
const getDisplayNearestPoint = vi.fn();

vi.mock("electron", () => ({
	screen: {
		getCursorScreenPoint: (...args: unknown[]) =>
			getCursorScreenPoint(...args),
		getDisplayNearestPoint: (...args: unknown[]) =>
			getDisplayNearestPoint(...args),
	},
}));

import {
	getActiveDisplay,
	getCenteredPopupPosition,
	getLeftBiasedPopupPosition,
	getRightBiasedPopupPosition,
	getTopCenterPopupPosition,
} from "../../../electron/infrastructure/windows/window-position";

const secondaryWorkArea = {
	x: 1920,
	y: 100,
	width: 1600,
	height: 900,
};

describe("window-position", () => {
	beforeEach(() => {
		getCursorScreenPoint.mockReset();
		getDisplayNearestPoint.mockReset();
		getCursorScreenPoint.mockReturnValue({ x: 2500, y: 400 });
		getDisplayNearestPoint.mockReturnValue({
			workArea: secondaryWorkArea,
			workAreaSize: {
				width: secondaryWorkArea.width,
				height: secondaryWorkArea.height,
			},
		});
	});

	it("resolves the display nearest the cursor", () => {
		const display = getActiveDisplay();

		expect(getCursorScreenPoint).toHaveBeenCalledOnce();
		expect(getDisplayNearestPoint).toHaveBeenCalledWith({ x: 2500, y: 400 });
		expect(display.workArea).toEqual(secondaryWorkArea);
	});

	it("centers a popup on the active display workArea including origin", () => {
		expect(getCenteredPopupPosition(300, 120)).toEqual({
			x: 1920 + Math.floor((1600 - 300) / 2),
			y: 100 + Math.floor((900 - 120) / 2),
		});
	});

	it("places a popup right-of-center on the active display workArea", () => {
		expect(getRightBiasedPopupPosition(300, 120)).toEqual({
			x: 1920 + Math.floor((1600 - 300) * 0.72),
			y: 100 + Math.floor((900 - 120) / 2),
		});
	});

	it("places a popup left-of-center on the active display workArea", () => {
		expect(getLeftBiasedPopupPosition(300, 120)).toEqual({
			x: 1920 + Math.floor((1600 - 300) * 0.28),
			y: 100 + Math.floor((900 - 120) / 2),
		});
	});

	it("places a toast at the top-center of the active display workArea", () => {
		expect(getTopCenterPopupPosition(220)).toEqual({
			x: 1920 + Math.floor((1600 - 220) / 2),
			y: 100 + 4,
		});
	});
});
