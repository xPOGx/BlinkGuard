import { describe, expect, it } from "vitest";
import {
	resolveSessionIdleCause,
	resolveSessionPauseMode,
	sessionPauseRank,
} from "../../../electron/domain/session-activity-policy";

const idle = {
	suspended: false,
	locked: false,
	displaysAsleep: false,
	lidClosed: false,
};

describe("resolveSessionPauseMode", () => {
	it("is active when the session is awake and unlocked", () => {
		expect(resolveSessionPauseMode(idle)).toBe("active");
	});

	it("treats suspend, lock, and display sleep as a full session pause", () => {
		expect(resolveSessionPauseMode({ ...idle, suspended: true })).toBe(
			"inactive",
		);
		expect(resolveSessionPauseMode({ ...idle, locked: true })).toBe("inactive");
		expect(resolveSessionPauseMode({ ...idle, displaysAsleep: true })).toBe(
			"inactive",
		);
	});

	it("uses camera-only pause for clamshell (lid closed, displays on)", () => {
		expect(resolveSessionPauseMode({ ...idle, lidClosed: true })).toBe(
			"camera-only",
		);
	});

	it("prefers full inactive when lid closed and displays are asleep", () => {
		expect(
			resolveSessionPauseMode({
				...idle,
				lidClosed: true,
				displaysAsleep: true,
			}),
		).toBe("inactive");
	});

	it("ranks inactive deeper than camera-only", () => {
		expect(sessionPauseRank("inactive")).toBeGreaterThan(
			sessionPauseRank("camera-only"),
		);
		expect(sessionPauseRank("camera-only")).toBeGreaterThan(
			sessionPauseRank("active"),
		);
	});
});

describe("resolveSessionIdleCause", () => {
	it("is null when no idle flags are set", () => {
		expect(resolveSessionIdleCause(idle)).toBeNull();
	});

	it("prefers suspend over lock, display-off, and lid", () => {
		expect(
			resolveSessionIdleCause({
				suspended: true,
				locked: true,
				displaysAsleep: true,
				lidClosed: true,
			}),
		).toBe("suspend");
		expect(resolveSessionIdleCause({ ...idle, suspended: true })).toBe(
			"suspend",
		);
	});

	it("prefers lock over display-off and lid", () => {
		expect(
			resolveSessionIdleCause({
				...idle,
				locked: true,
				displaysAsleep: true,
				lidClosed: true,
			}),
		).toBe("lock");
		expect(resolveSessionIdleCause({ ...idle, locked: true })).toBe("lock");
	});

	it("uses display-off when lid is also closed", () => {
		expect(
			resolveSessionIdleCause({
				...idle,
				displaysAsleep: true,
				lidClosed: true,
			}),
		).toBe("display-off");
		expect(resolveSessionIdleCause({ ...idle, displaysAsleep: true })).toBe(
			"display-off",
		);
	});

	it("uses lid when it is the only flag", () => {
		expect(resolveSessionIdleCause({ ...idle, lidClosed: true })).toBe("lid");
	});
});
