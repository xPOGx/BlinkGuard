// Blink / starting / stopped reminder popups

function initReminderPopup() {
	updateColors({
		background: "#1F2937",
		text: "#F9FAFB",
		transparency: 0.15,
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
