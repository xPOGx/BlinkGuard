import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { useCallback, useEffect, useState } from "react";

interface ShortcutControlsInput {
	preferences: SettingsPreferences;
	setPreferences: SetPreferences;
	toggleTracking: () => void;
}

export function useShortcutControls({
	preferences,
	setPreferences,
	toggleTracking,
}: ShortcutControlsInput) {
	const [isRecording, setIsRecording] = useState(false);
	const [temporaryShortcut, setTemporaryShortcut] = useState("");
	const [error, setError] = useState("");

	useEffect(
		() =>
			rendererIpc.onShortcutError((shortcut) => {
				if (shortcut) {
					setError(
						`Invalid shortcut: ${shortcut}. Please use only ASCII characters and valid combinations.`,
					);
					setIsRecording(true);
				} else {
					setError("");
				}
			}),
		[],
	);

	const save = useCallback(() => {
		if (
			[...temporaryShortcut].some((character) => character.charCodeAt(0) > 127)
		) {
			setError("Shortcut must only contain ASCII characters.");
			return;
		}
		if (temporaryShortcut.split("+").length < 2) {
			setError(
				"Please use at least one modifier key (Ctrl, Shift, Alt) and one regular key",
			);
			return;
		}
		setPreferences((current) => ({
			...current,
			keyboardShortcut: temporaryShortcut,
		}));
		setIsRecording(false);
		setError("");
		rendererIpc.updateKeyboardShortcut(temporaryShortcut);
	}, [setPreferences, temporaryShortcut]);

	const cancel = useCallback(() => {
		setIsRecording(false);
		setTemporaryShortcut("");
		setError("");
	}, []);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (isRecording) {
				event.preventDefault();
				if (event.key === "Enter") {
					save();
					return;
				}
				if (event.key === "Escape") {
					cancel();
					return;
				}

				const keys: string[] = [];
				if (event.ctrlKey) keys.push("Ctrl");
				if (event.shiftKey) keys.push("Shift");
				if (event.altKey) keys.push("Alt");
				if (event.metaKey) keys.push("Meta");
				if (
					!["Control", "Shift", "Alt", "Meta", "Enter", "Escape"].includes(
						event.key,
					)
				) {
					keys.push(event.key.toUpperCase());
				}
				if (keys.length > 0) setTemporaryShortcut(keys.join("+"));
				return;
			}

			const pressedKeys: string[] = [];
			if (event.ctrlKey) pressedKeys.push("Ctrl");
			if (event.shiftKey) pressedKeys.push("Shift");
			if (event.altKey) pressedKeys.push("Alt");
			if (event.metaKey) pressedKeys.push("Meta");
			if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
				pressedKeys.push(event.key.toUpperCase());
			}
			if (pressedKeys.join("+") === preferences.keyboardShortcut) {
				event.preventDefault();
				toggleTracking();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [cancel, isRecording, preferences.keyboardShortcut, save, toggleTracking]);

	return {
		isRecording,
		temporaryShortcut,
		error,
		startRecording: () => {
			setIsRecording(true);
			setTemporaryShortcut(preferences.keyboardShortcut);
			setError("");
		},
		setTemporaryShortcut,
		save,
		cancel,
	};
}
