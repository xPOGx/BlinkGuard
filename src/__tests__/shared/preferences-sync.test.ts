import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_RENDERER_PREFERENCES } from "@/features/settings/model/preferences";
import {
	pushPreferenceDiff,
	sameRendererPrefs,
} from "@/features/settings/model/preferences-sync";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";

vi.mock("@/shared/ipc/renderer-ipc", () => ({
	rendererIpc: {
		updateDarkMode: vi.fn(),
		updateCameraEnabled: vi.fn(),
		updateCameraQuality: vi.fn(),
		updateAutoStopNoFaceEnabled: vi.fn(),
		updateAutoStopNoFaceMinutes: vi.fn(),
		updateSnoozeMinutes: vi.fn(),
		updateEarCalibration: vi.fn(),
		updateEyeExercisesEnabled: vi.fn(),
		updateExerciseInterval: vi.fn(),
		updateExercisePrompts: vi.fn(),
		updateEyeCareIndependentOfTracking: vi.fn(),
		updateLookAwayEnabled: vi.fn(),
		updateLookAwayInterval: vi.fn(),
		updateLookAwayDuration: vi.fn(),
		updateLookAwayTitle: vi.fn(),
		updateLookAwayHint: vi.fn(),
		updatePopupColors: vi.fn(),
		updatePopupTransparency: vi.fn(),
		updatePopupMessage: vi.fn(),
		updateBlinkPopupClickThrough: vi.fn(),
		updateKeyboardShortcuts: vi.fn(),
		updateMgdMode: vi.fn(),
		updateSoundEnabled: vi.fn(),
		updateSoundVolume: vi.fn(),
		updateLaunchAtLogin: vi.fn(),
		updateQuietHoursEnabled: vi.fn(),
		updateQuietHoursStart: vi.fn(),
		updateQuietHoursEnd: vi.fn(),
		updatePauseOnFullscreen: vi.fn(),
		updateBlinkRateCoachingEnabled: vi.fn(),
		updateBlinkRateThreshold: vi.fn(),
		updateLocale: vi.fn(),
		updateHasCompletedOnboarding: vi.fn(),
		updateGoalsConfig: vi.fn(),
	},
}));

describe("sameRendererPrefs", () => {
	it("ignores UI-only flags", () => {
		const a = { ...DEFAULT_RENDERER_PREFERENCES, showMgdInfo: false };
		const b = { ...DEFAULT_RENDERER_PREFERENCES, showMgdInfo: true };
		expect(sameRendererPrefs(a, b)).toBe(true);
	});

	it("detects nested popup and prompt changes", () => {
		const base = { ...DEFAULT_RENDERER_PREFERENCES };
		expect(
			sameRendererPrefs(base, {
				...base,
				popupColors: { ...base.popupColors, transparency: 0.5 },
			}),
		).toBe(false);
		expect(
			sameRendererPrefs(base, {
				...base,
				exercisePrompts: [...base.exercisePrompts, "extra"],
			}),
		).toBe(false);
		expect(
			sameRendererPrefs(base, {
				...base,
				lookAwayTitle: "Custom title",
			}),
		).toBe(false);
		expect(
			sameRendererPrefs(base, {
				...base,
				lookAwayHint: "Custom hint",
			}),
		).toBe(false);
		expect(
			sameRendererPrefs(base, {
				...base,
				popupPosition: { x: 1, y: 2 },
			}),
		).toBe(false);
	});

	it("detects auto-stop no-face preference changes", () => {
		const base = { ...DEFAULT_RENDERER_PREFERENCES };
		expect(
			sameRendererPrefs(base, {
				...base,
				autoStopNoFaceEnabled: false,
			}),
		).toBe(false);
		expect(
			sameRendererPrefs(base, {
				...base,
				autoStopNoFaceMinutes: 5,
			}),
		).toBe(false);
	});

	it("detects snoozeMinutes preference changes", () => {
		const base = { ...DEFAULT_RENDERER_PREFERENCES };
		expect(
			sameRendererPrefs(base, {
				...base,
				snoozeMinutes: 10,
			}),
		).toBe(false);
	});

	it("detects keyboardShortcuts map changes", () => {
		const base = { ...DEFAULT_RENDERER_PREFERENCES };
		expect(
			sameRendererPrefs(base, {
				...base,
				keyboardShortcuts: {
					...base.keyboardShortcuts,
					snoozeAll: "Ctrl+Shift+S",
				},
			}),
		).toBe(false);
	});

	it("detects sound volume preference changes", () => {
		const base = { ...DEFAULT_RENDERER_PREFERENCES };
		expect(
			sameRendererPrefs(base, {
				...base,
				soundVolume: 40,
			}),
		).toBe(false);
	});
});

describe("pushPreferenceDiff", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("pushes only the fields that changed", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES, darkMode: true };
		const next = {
			...previous,
			darkMode: false,
			soundEnabled: true,
			locale: "uk" as const,
		};

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateDarkMode).toHaveBeenCalledWith(false);
		expect(rendererIpc.updateSoundEnabled).toHaveBeenCalledWith(true);
		expect(rendererIpc.updateLocale).toHaveBeenCalledWith("uk");
		expect(rendererIpc.updateCameraEnabled).not.toHaveBeenCalled();
		expect(rendererIpc.updateEyeExercisesEnabled).not.toHaveBeenCalled();
		expect(rendererIpc.updateLookAwayEnabled).not.toHaveBeenCalled();
		expect(rendererIpc.updateKeyboardShortcuts).not.toHaveBeenCalled();
		expect(rendererIpc.updateAutoStopNoFaceEnabled).not.toHaveBeenCalled();
	});

	it("does not touch locale when only unrelated prefs change", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES };
		const next = { ...previous, quietHoursEnabled: false, mgdMode: true };

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateQuietHoursEnabled).toHaveBeenCalledWith(false);
		expect(rendererIpc.updateMgdMode).toHaveBeenCalledWith(true);
		expect(rendererIpc.updateLocale).not.toHaveBeenCalled();
		expect(rendererIpc.updateDarkMode).not.toHaveBeenCalled();
	});

	it("pushes only auto-stop no-face fields when they change", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES };
		const next = {
			...previous,
			autoStopNoFaceEnabled: false,
			autoStopNoFaceMinutes: 10,
		};

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateAutoStopNoFaceEnabled).toHaveBeenCalledWith(false);
		expect(rendererIpc.updateAutoStopNoFaceMinutes).toHaveBeenCalledWith(10);
		expect(rendererIpc.updateLocale).not.toHaveBeenCalled();
		expect(rendererIpc.updateCameraEnabled).not.toHaveBeenCalled();
	});

	it("pushes keyboardShortcuts when the map changes", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES };
		const next = {
			...previous,
			keyboardShortcuts: {
				...previous.keyboardShortcuts,
				snoozeAll: "Ctrl+Shift+S",
			},
		};

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateKeyboardShortcuts).toHaveBeenCalledWith(
			next.keyboardShortcuts,
		);
		expect(rendererIpc.updateLocale).not.toHaveBeenCalled();
	});

	it("pushes only snoozeMinutes when it changes", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES };
		const next = { ...previous, snoozeMinutes: 12 };

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateSnoozeMinutes).toHaveBeenCalledWith(12);
		expect(rendererIpc.updateLocale).not.toHaveBeenCalled();
		expect(rendererIpc.updateAutoStopNoFaceMinutes).not.toHaveBeenCalled();
	});

	it("pushes only sound volume when it changes", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES };
		const next = { ...previous, soundVolume: 55 };

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateSoundVolume).toHaveBeenCalledWith(55);
		expect(rendererIpc.updateSoundEnabled).not.toHaveBeenCalled();
		expect(rendererIpc.updateLocale).not.toHaveBeenCalled();
	});

	it("pushes only blink click-through when it changes", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES };
		const next = { ...previous, blinkPopupClickThrough: false };

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateBlinkPopupClickThrough).toHaveBeenCalledWith(
			false,
		);
		expect(rendererIpc.updateLocale).not.toHaveBeenCalled();
		expect(rendererIpc.updatePopupMessage).not.toHaveBeenCalled();
	});

	it("pushes only eye-care independence when it changes", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES };
		const next = { ...previous, eyeCareIndependentOfTracking: false };

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateEyeCareIndependentOfTracking).toHaveBeenCalledWith(
			false,
		);
		expect(rendererIpc.updateEyeExercisesEnabled).not.toHaveBeenCalled();
		expect(rendererIpc.updateLookAwayEnabled).not.toHaveBeenCalled();
		expect(rendererIpc.updateLocale).not.toHaveBeenCalled();
	});

	it("pushes only look-away copy when title or hint change", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES };
		const next = {
			...previous,
			lookAwayTitle: "Rest your eyes",
			lookAwayHint: "Look at a distant tree",
		};

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateLookAwayTitle).toHaveBeenCalledWith(
			"Rest your eyes",
		);
		expect(rendererIpc.updateLookAwayHint).toHaveBeenCalledWith(
			"Look at a distant tree",
		);
		expect(rendererIpc.updateLookAwayDuration).not.toHaveBeenCalled();
		expect(rendererIpc.updateLocale).not.toHaveBeenCalled();
	});

	it("pushes goals config once when any goal field changes", () => {
		const previous = { ...DEFAULT_RENDERER_PREFERENCES };
		const next = { ...previous, dailyBlinkGoal: 300 };

		pushPreferenceDiff(previous, next);

		expect(rendererIpc.updateGoalsConfig).toHaveBeenCalledWith({
			goalsEnabled: next.goalsEnabled,
			dailyBlinkGoal: 300,
			dailyTrackingMinutesGoal: next.dailyTrackingMinutesGoal,
			weeklyBlinkGoal: next.weeklyBlinkGoal,
			weeklyTrackingMinutesGoal: next.weeklyTrackingMinutesGoal,
		});
		expect(rendererIpc.updateLocale).not.toHaveBeenCalled();
	});

	it("detects goals preference changes", () => {
		const base = { ...DEFAULT_RENDERER_PREFERENCES };
		expect(
			sameRendererPrefs(base, {
				...base,
				goalsEnabled: false,
			}),
		).toBe(false);
		expect(
			sameRendererPrefs(base, {
				...base,
				weeklyTrackingMinutesGoal: 120,
			}),
		).toBe(false);
	});
});
