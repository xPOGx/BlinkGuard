import { describe, expect, it } from "vitest";
import {
	DEBUG_OVERLAY_KINDS,
	isDebugOverlayKind,
} from "../../../shared/debug-preview";

describe("debug-preview", () => {
	it("accepts known overlay kinds", () => {
		for (const kind of DEBUG_OVERLAY_KINDS) {
			expect(isDebugOverlayKind(kind)).toBe(true);
		}
	});

	it("rejects unknown values", () => {
		expect(isDebugOverlayKind("blink-rate")).toBe(false);
		expect(isDebugOverlayKind(null)).toBe(false);
		expect(isDebugOverlayKind(1)).toBe(false);
	});
});
