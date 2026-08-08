import { describe, expect, it } from "vitest";
import {
	DEBUG_OVERLAY_KINDS,
	DEBUG_SOUND_KINDS,
	isDebugOverlayKind,
	isDebugSoundKind,
} from "../../../shared/debug-preview";

describe("debug-preview", () => {
	it("accepts known overlay kinds", () => {
		for (const kind of DEBUG_OVERLAY_KINDS) {
			expect(isDebugOverlayKind(kind)).toBe(true);
		}
	});

	it("rejects unknown overlay values", () => {
		expect(isDebugOverlayKind("blink-rate")).toBe(false);
		expect(isDebugOverlayKind(null)).toBe(false);
		expect(isDebugOverlayKind(1)).toBe(false);
	});

	it("accepts known sound kinds", () => {
		for (const kind of DEBUG_SOUND_KINDS) {
			expect(isDebugSoundKind(kind)).toBe(true);
		}
	});

	it("rejects unknown sound values", () => {
		expect(isDebugSoundKind("coach")).toBe(false);
		expect(isDebugSoundKind(null)).toBe(false);
		expect(isDebugSoundKind(1)).toBe(false);
	});
});
