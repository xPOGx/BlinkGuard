import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionActivity } from "../../../electron/infrastructure/session-activity/create-session-activity";

describe("createSessionActivity", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns a no-op stub on linux", () => {
		const onChange = vi.fn();
		const env = createSessionActivity(onChange, "linux");
		env.start();
		expect(onChange).not.toHaveBeenCalled();
		env.dispose();
	});

	it("returns a windows host on win32", () => {
		const env = createSessionActivity(vi.fn(), "win32");
		env.dispose();
	});

	it("returns a macos host on darwin", () => {
		const env = createSessionActivity(vi.fn(), "darwin");
		env.dispose();
	});
});
