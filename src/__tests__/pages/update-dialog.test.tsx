import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UpdateDialog } from "@/features/about/ui/update-dialog";
import { I18nProvider } from "@/i18n";
import type { AutoUpdateStatus } from "../../../shared/auto-update";

function renderDialog(
	status: AutoUpdateStatus,
	handlers: { install?: () => void; dismiss?: () => void } = {},
) {
	const install = handlers.install ?? vi.fn();
	const dismiss = handlers.dismiss ?? vi.fn();
	render(
		<I18nProvider locale="en">
			<UpdateDialog
				status={status}
				busy={false}
				check={vi.fn()}
				install={install}
				dismiss={dismiss}
			/>
		</I18nProvider>,
	);
	return { install, dismiss };
}

describe("UpdateDialog", () => {
	it("renders nothing when idle", () => {
		render(
			<I18nProvider locale="en">
				<UpdateDialog
					status={{ state: "idle" }}
					busy={false}
					check={vi.fn()}
					install={vi.fn()}
					dismiss={vi.fn()}
				/>
			</I18nProvider>,
		);
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("ignores toast-surface statuses", () => {
		renderDialog({ state: "checking", surface: "toast" });
		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("shows unavailable copy in unpackaged/dev messaging", () => {
		renderDialog({ state: "unavailable", surface: "dialog" });
		expect(
			screen.getByRole("dialog", { name: "Updates unavailable" }),
		).toBeDefined();
		expect(
			screen.getByText(
				"Automatic updates are only available in the packaged Windows and macOS apps.",
			),
		).toBeDefined();
	});

	it("Restart sends install and Later dismisses ready state", () => {
		const { install, dismiss } = renderDialog({
			state: "ready",
			version: "1.2.3",
			surface: "dialog",
		});
		expect(
			screen.getByText(
				"BlinkGuard 1.2.3 has been downloaded. Restart to install.",
			),
		).toBeDefined();
		fireEvent.click(screen.getByRole("button", { name: "Restart" }));
		expect(install).toHaveBeenCalledOnce();
		fireEvent.click(screen.getByRole("button", { name: "Later" }));
		expect(dismiss).toHaveBeenCalledOnce();
	});

	it("shows download progress percent", () => {
		renderDialog({
			state: "downloading",
			version: "2.0.0",
			percent: 55,
			surface: "dialog",
		});
		expect(screen.getByText("Downloading BlinkGuard 2.0.0… 55%")).toBeDefined();
		expect(screen.queryByRole("button", { name: "OK" })).toBeNull();
	});
});
