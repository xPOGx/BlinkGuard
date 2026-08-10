import { beforeEach, describe, expect, it, vi } from "vitest";

const getCursorScreenPoint = vi.fn();
const getDisplayNearestPoint = vi.fn();
const getAllDisplays = vi.fn();

vi.mock("electron", () => ({
	screen: {
		getCursorScreenPoint: (...args: unknown[]) =>
			getCursorScreenPoint(...args),
		getDisplayNearestPoint: (...args: unknown[]) =>
			getDisplayNearestPoint(...args),
		getAllDisplays: (...args: unknown[]) => getAllDisplays(...args),
	},
}));

import {
	getActiveDisplay,
	getCenteredPopupPosition,
	getLeftBiasedPopupPosition,
	getRightBiasedPopupPosition,
	getTopCenterPopupPosition,
	isPointInAnyWorkArea,
	resolvePopupPosition,
	resolveVisiblePopupPosition,
} from "../../../electron/infrastructure/windows/window-position";

const primaryWorkArea = {
	x: 0,
	y: 0,
	width: 1920,
	height: 1080,
};

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
		getAllDisplays.mockReset();
		getCursorScreenPoint.mockReturnValue({ x: 2500, y: 400 });
		getDisplayNearestPoint.mockReturnValue({
			workArea: secondaryWorkArea,
			workAreaSize: {
				width: secondaryWorkArea.width,
				height: secondaryWorkArea.height,
			},
		});
		getAllDisplays.mockReturnValue([
			{ workArea: primaryWorkArea },
			{ workArea: secondaryWorkArea },
		]);
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

	describe("isPointInAnyWorkArea / resolvePopupPosition", () => {
		const fallback = { x: 810, y: 480 };

		it("keeps a point on the primary workArea", () => {
			const saved = { x: 100, y: 200 };
			expect(isPointInAnyWorkArea(saved, [primaryWorkArea])).toBe(true);
			expect(
				resolvePopupPosition(saved, { width: 300, height: 120 }, [primaryWorkArea], fallback),
			).toEqual({ position: saved, recovered: false });
		});

		it("keeps a point on the secondary workArea", () => {
			const saved = { x: 2500, y: 400 };
			expect(
				isPointInAnyWorkArea(saved, [primaryWorkArea, secondaryWorkArea]),
			).toBe(true);
			expect(
				resolvePopupPosition(
					saved,
					{ width: 300, height: 120 },
					[primaryWorkArea, secondaryWorkArea],
					fallback,
				),
			).toEqual({ position: saved, recovered: false });
		});

		it("recovers a point on a removed secondary display", () => {
			const saved = { x: 2500, y: 400 };
			expect(isPointInAnyWorkArea(saved, [primaryWorkArea])).toBe(false);
			expect(
				resolvePopupPosition(saved, { width: 300, height: 120 }, [primaryWorkArea], fallback),
			).toEqual({ position: fallback, recovered: true });
		});

		it("uses fallback for null saved without marking recovered", () => {
			expect(
				resolvePopupPosition(null, { width: 300, height: 120 }, [primaryWorkArea], fallback),
			).toEqual({ position: fallback, recovered: false });
		});

		it("treats the inclusive top-left workArea corner as valid", () => {
			expect(
				isPointInAnyWorkArea({ x: 0, y: 0 }, [primaryWorkArea]),
			).toBe(true);
			expect(
				isPointInAnyWorkArea({ x: 1920, y: 100 }, [secondaryWorkArea]),
			).toBe(true);
		});

		it("treats the exclusive bottom-right edge as off-screen", () => {
			expect(
				isPointInAnyWorkArea({ x: 1920, y: 0 }, [primaryWorkArea]),
			).toBe(false);
			expect(
				isPointInAnyWorkArea({ x: 0, y: 1080 }, [primaryWorkArea]),
			).toBe(false);
		});

		it("resolveVisiblePopupPosition recovers via active-display center", () => {
			getAllDisplays.mockReturnValue([{ workArea: primaryWorkArea }]);
			const result = resolveVisiblePopupPosition(
				{ x: 2500, y: 400 },
				{ width: 300, height: 120 },
			);
			expect(result).toEqual({
				position: getCenteredPopupPosition(300, 120),
				recovered: true,
			});
		});
	});
});
