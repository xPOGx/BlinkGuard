import { useCallback, useEffect, useState } from "react";
import type { SettingsPreferences } from "@/features/settings/model/preferences";
import type { SetPreferences } from "@/features/settings/model/use-preferences";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { t } from "../../../../shared/i18n";

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
	const locale = preferences.locale;

	useEffect(
		() =>
			rendererIpc.onShortcutError((shortcut) => {
				if (shortcut) {
					setError(t(locale, "shortcut.invalid", { shortcut }));
					setIsRecording(true);
				} else {
					setError("");
				}
			}),
		[locale],
	);

	const save = useCallback(() => {
		if (
			[...temporaryShortcut].some((character) => character.charCodeAt(0) > 127)
		) {
			setError(t(locale, "shortcut.asciiOnly"));
			return;
		}
		if (temporaryShortcut.split("+").length < 2) {
			setError(t(locale, "shortcut.needModifier"));
			return;
		}
		setPreferences((current) => ({
			...current,
			keyboardShortcut: temporaryShortcut,
		}));
		setIsRecording(false);
		setError("");
		rendererIpc.updateKeyboardShortcut(temporaryShortcut);
	}, [locale, setPreferences, temporaryShortcut]);

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
