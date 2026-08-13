// Exercise popup

function skipExercise() {
	window.popupAPI.skipExercise();
	window.close();
}

function snoozeExercise() {
	window.popupAPI.snoozeExercise();
	window.close();
}

function applyExerciseClickThrough(enabled) {
	const a11y = window.__popupA11y;
	const root = document.getElementById("container");
	const actions = document.querySelector(".exercise-buttons");
	const snoozeBtn = document.querySelector(".exercise-button.snooze");
	if (!a11y || !root) return;

	a11y.setActionsHidden(actions, enabled);
	if (enabled) {
		a11y.teardownInteractiveDialog(root);
		return;
	}
	a11y.mountInteractiveDialog({
		root: root,
		labelledById: "exercise-title",
		primaryEl: snoozeBtn,
		onEscape: snoozeExercise,
	});
}

function initExercisePopup() {
	const exerciseElement = document.getElementById("exercise");
	window.popupAPI.onUpdateExercisePrompt((prompt) => {
		if (exerciseElement) {
			exerciseElement.textContent = prompt;
		}
	});

	const skipBtn = document.querySelector(".exercise-button.skip");
	const snoozeBtn = document.querySelector(".exercise-button.snooze");

	if (skipBtn) {
		skipBtn.addEventListener("click", skipExercise);
	}

	if (snoozeBtn) {
		snoozeBtn.addEventListener("click", snoozeExercise);
	}

	window.popupAPI.onBlinkClickThrough(applyExerciseClickThrough);
}

function initExercise() {
	updateColors({
		background: "#0F172A",
		text: "#F8FAFC",
		transparency: 0.15,
	});

	initExercisePopup();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initExercise);
} else {
	initExercise();
}
