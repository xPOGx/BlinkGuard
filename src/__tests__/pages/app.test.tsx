import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/app";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";

const send = vi.fn();
const listeners = new Map<string, (...args: unknown[]) => void>();

beforeEach(() => {
	listeners.clear();
	Object.defineProperty(window, "ipcRenderer", {
		configurable: true,
		value: {
			send,
			on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
				listeners.set(channel, listener);
			}),
			off: vi.fn(),
		},
	});
});

describe("settings shell", () => {
	it("renders the main settings controls", () => {
		render(<App />);

		expect(screen.getByRole("heading", { name: "BlinkGuard" })).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Start Reminders" }),
		).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "System" }));
		expect(screen.getByText("Keyboard Shortcut")).toBeDefined();
	});

	it("starts reminders with the renderer interval converted to milliseconds", () => {
		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "Start Reminders" }));

		expect(send).toHaveBeenCalledWith(IPC_CHANNELS.startBlinkReminders, 3000);
	});

	it("records and sends a keyboard shortcut", () => {
		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "System" }));
		fireEvent.click(screen.getByRole("button", { name: "Change" }));
		fireEvent.keyDown(window, { key: "k", ctrlKey: true });
		fireEvent.keyDown(window, { key: "Enter" });

		expect(send).toHaveBeenCalledWith(
			IPC_CHANNELS.updateKeyboardShortcut,
			"Ctrl+K",
		);
	});
});
