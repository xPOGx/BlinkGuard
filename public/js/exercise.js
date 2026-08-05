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
	const exercises = [
		"Close your eyes and gently roll them in a circular motion for 10 seconds. Then reverse direction.",
		"Close your eyes and look up and down slowly 5 times, then left and right 5 times.",
		"Take a deep breath and yawn naturally a few times to help lubricate your eyes.",
		"Take a break and look at something 20 feet away for 20 seconds.",
	];

	let currentExerciseIndex = parseInt(localStorage.getItem("currentExerciseIndex") || "0");

	let currentExercise = exercises[currentExerciseIndex];
	const exerciseElement = document.getElementById("exercise");
	if (exerciseElement) {
		exerciseElement.textContent = currentExercise;
	}

	currentExerciseIndex = (currentExerciseIndex + 1) % exercises.length;
	localStorage.setItem("currentExerciseIndex", currentExerciseIndex.toString());

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
