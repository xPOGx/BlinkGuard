// Shared popup theme helpers (CSS variables + reminder text/mode)

function updateColors(colors) {
	if (colors.background) {
		document.documentElement.style.setProperty("--popup-bg-color", colors.background);
	}
	if (colors.text) {
		document.documentElement.style.setProperty("--popup-text-color", colors.text);
	}
}

function updateMessage(message) {
	const blinkElement = document.getElementById("blink");
	if (!blinkElement) return;
	const messageEl = blinkElement.querySelector(".reminder-message");
	if (messageEl) {
		messageEl.textContent = message;
	} else {
		blinkElement.textContent = message;
	}
}

function updateCameraMode(isEnabled) {
	const blinkElement = document.getElementById("blink");
	if (!blinkElement) return;
	blinkElement.classList.toggle("camera-mode", Boolean(isEnabled));
}
