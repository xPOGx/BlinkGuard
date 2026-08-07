import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/app";
import { IPC_CHANNELS } from "../../../shared/ipc-channels";
import {
	DEFAULT_PREFERENCES,
	type RendererPreferences,
	toRendererPreferences,
} from "../../../shared/preferences";

vi.mock("lottie-web", () => ({
	default: {
		loadAnimation: () => ({
			goToAndStop: vi.fn(),
			goToAndPlay: vi.fn(),
			playSegments: vi.fn(),
			resetSegments: vi.fn(),
			setSpeed: vi.fn(),
			setDirection: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			destroy: vi.fn(),
			currentFrame: 0,
			loop: true,
		}),
	},
}));

const send = vi.fn();
const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

function hydratePreferences(
	overrides: Partial<RendererPreferences> = {},
): void {
	const channelListeners = listeners.get(IPC_CHANNELS.loadPreferences);
	expect(channelListeners?.size).toBeGreaterThan(0);
	act(() => {
		for (const listener of channelListeners ?? []) {
			listener({
				...toRendererPreferences(DEFAULT_PREFERENCES),
				...overrides,
			});
		}
	});
}

beforeEach(() => {
	listeners.clear();
	send.mockClear();
	Object.defineProperty(window, "ipcRenderer", {
		configurable: true,
		value: {
			send,
			on: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
				const set = listeners.get(channel) ?? new Set();
				set.add(listener);
				listeners.set(channel, set);
			}),
			off: vi.fn((channel: string, listener: (...args: unknown[]) => void) => {
				listeners.get(channel)?.delete(listener);
			}),
		},
	});
});

describe("settings shell", () => {
	it("renders the main settings controls", () => {
		render(<App />);

		expect(screen.getByRole("heading", { name: "BlinkGuard" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Start" })).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "System" }));
		expect(screen.getByText("Keyboard Shortcut")).toBeDefined();
		expect(screen.getByText("Quiet hours")).toBeDefined();
		expect(screen.getByText("Pause while fullscreen")).toBeDefined();

		fireEvent.click(screen.getByRole("button", { name: "Statistics" }));
		expect(screen.getByText("Blink chart")).toBeDefined();
		expect(
			screen.getByRole("button", { name: "Clear statistics" }),
		).toBeDefined();
		expect(send).toHaveBeenCalledWith(IPC_CHANNELS.subscribeBlinkStats);

		fireEvent.click(screen.getByRole("button", { name: "Reminders" }));
		expect(send).toHaveBeenCalledWith(IPC_CHANNELS.unsubscribeBlinkStats);
	});

	it("shows first-run onboarding after prefs hydrate incomplete", () => {
		render(<App />);
		expect(screen.queryByRole("dialog")).toBeNull();

		hydratePreferences({ hasCompletedOnboarding: false });

		expect(screen.getByRole("dialog")).toBeDefined();
		expect(screen.getByText("Welcome to BlinkGuard")).toBeDefined();
		expect(
			screen.getByRole("heading", { name: "Reminder mode" }),
		).toBeDefined();
	});

	it("hides onboarding when prefs hydrate as completed", () => {
		render(<App />);
		hydratePreferences({ hasCompletedOnboarding: true });

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(screen.queryByText("Welcome to BlinkGuard")).toBeNull();
	});

	it("dismisses onboarding when Skip is pressed", () => {
		render(<App />);
		hydratePreferences({ hasCompletedOnboarding: false });

		fireEvent.click(screen.getByRole("button", { name: "Skip" }));

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(send).toHaveBeenCalledWith(
			IPC_CHANNELS.updateHasCompletedOnboarding,
			true,
		);
	});

	it("dismisses onboarding when Finish is pressed", () => {
		render(<App />);
		hydratePreferences({ hasCompletedOnboarding: false });

		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		fireEvent.click(screen.getByRole("button", { name: "Next" }));
		fireEvent.click(screen.getByRole("button", { name: "Finish" }));

		expect(screen.queryByRole("dialog")).toBeNull();
		expect(send).toHaveBeenCalledWith(
			IPC_CHANNELS.updateHasCompletedOnboarding,
			true,
		);
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
		fireEvent.click(
			screen.getByRole("switch", { name: "Toggle eye exercises" }),
		);
		fireEvent.click(
			screen.getByRole("switch", { name: "Toggle look-away breaks" }),
		);

		expect(screen.getByText("Eye strain risk")).toBeDefined();
		expect(screen.getByText(/both turned off/i)).toBeDefined();
	});

	it("starts reminders with the renderer interval converted to milliseconds", () => {
		render(<App />);

		fireEvent.click(screen.getByRole("button", { name: "Start" }));

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
