import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/app";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";

vi.mock("lottie-react", () => ({
	default: {
		useLottie: () => ({
			View: null,
			goToAndPlay: vi.fn(),
			goToAndStop: vi.fn(),
			setSpeed: vi.fn(),
			animationLoaded: false,
		}),
	},
}));

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
		expect(screen.getByText("Quiet hours")).toBeDefined();
		expect(screen.getByText("Pause while fullscreen")).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "Statistics" }));
		expect(screen.getByText("Blink chart")).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Clear statistics" }),
		).toBeDefined();
	});

	it("renders eye-care controls for exercises and look-away", () => {
		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "Eye care" }));
		expect(screen.getByText("Eye Exercises")).toBeDefined();
		expect(screen.getByText("20-20-20 Look Away")).toBeDefined();
		expect(screen.queryByText("Eye strain risk")).toBeNull();
	});

	it("warns about eye strain when all eye-care prompts are disabled", () => {
		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "Eye care" }));
		fireEvent.click(screen.getByRole("switch", { name: "Toggle eye exercises" }));
		fireEvent.click(
			screen.getByRole("switch", { name: "Toggle look-away breaks" }),
		);

		expect(screen.getByText("Eye strain risk")).toBeDefined();
		expect(
			screen.getByText(/both turned off/i),
		).toBeDefined();
	});

	it("starts reminders with the renderer interval converted to milliseconds", () => {
		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "Start Reminders" }));

		expect(send).toHaveBeenCalledWith(IPC_CHANNELS.startBlinkReminders, 3000);
	});

	it("toggles tracking from the sidebar eye button", () => {
		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "Start reminders" }));
		expect(send).toHaveBeenCalledWith(IPC_CHANNELS.startBlinkReminders, 3000);

		fireEvent.click(screen.getByRole("button", { name: "Stop reminders" }));
		expect(send).toHaveBeenCalledWith(IPC_CHANNELS.stopBlinkReminders);
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
