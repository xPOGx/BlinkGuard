// Blink / starting / stopped reminder popups

function initReminderPopup() {
	updateColors({
		background: "#1E1E1E",
		text: "#FFFFFF",
		transparency: 0.3,
	});

	window.popupAPI.onUpdateColors(updateColors);
	window.popupAPI.onUpdateMessage(updateMessage);
	window.popupAPI.onCameraMode(updateCameraMode);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initReminderPopup);
} else {
	initReminderPopup();
}
