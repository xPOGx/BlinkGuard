// Blink / starting / stopped reminder popups

function initReminderPopup() {
	updateColors({
		background: "#0F172A",
		text: "#F8FAFC",
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
