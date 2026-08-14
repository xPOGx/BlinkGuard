import { describe, expect, it } from "vitest";
import { EMPTY_SESSION_ACTIVITY } from "../../../electron/application/ports/session-activity-port";
import { parseSessionActivityLine } from "../../../electron/infrastructure/session-activity/session-activity-protocol";

describe("parseSessionActivityLine", () => {
	it("maps display and lid tokens", () => {
		const off = parseSessionActivityLine("d0", EMPTY_SESSION_ACTIVITY);
		expect(off).toEqual({ displaysAsleep: true, lidClosed: false });
		if (!off) throw new Error("expected d0 parse");
		expect(parseSessionActivityLine("d1", off)).toEqual({
			displaysAsleep: false,
			lidClosed: false,
		});
		expect(parseSessionActivityLine("d2", off)).toEqual({
			displaysAsleep: false,
			lidClosed: false,
		});
		expect(parseSessionActivityLine("l1", EMPTY_SESSION_ACTIVITY)).toEqual({
			displaysAsleep: false,
			lidClosed: true,
		});
		expect(
			parseSessionActivityLine("l0", {
				displaysAsleep: false,
				lidClosed: true,
			}),
		).toEqual({ displaysAsleep: false, lidClosed: false });
	});

	it("ignores unknown lines", () => {
		expect(parseSessionActivityLine("nope", EMPTY_SESSION_ACTIVITY)).toBeNull();
		expect(parseSessionActivityLine("  ", EMPTY_SESSION_ACTIVITY)).toBeNull();
	});
});
