// Exercise popup

function skipExercise() {
	window.popupAPI.skipExercise();
	window.close();
}

function snoozeExercise() {
	window.popupAPI.snoozeExercise();
	window.close();
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
}

function initExercise() {
	updateColors({
		background: "#1E1E1E",
		text: "#FFFFFF",
		transparency: 0.3,
	});

	initExercisePopup();
	// Transparent background so the card is not double-darkened
	updateColors({
		background: "transparent",
		text: "#FFFFFF",
		transparency: 0.3,
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initExercise);
} else {
	initExercise();
}
