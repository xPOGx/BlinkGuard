// Blink / starting / stopped reminder popups

function snoozeBlink() {
	window.popupAPI.snoozeBlink();
}

function initReminderPopup() {
	updateColors({
		background: "#0F172A",
		text: "#F8FAFC",
		transparency: 0.15,
	});

	window.popupAPI.onUpdateColors(updateColors);
	window.popupAPI.onUpdateMessage(updateMessage);
	window.popupAPI.onCameraMode(updateCameraMode);

	const snoozeBtn = document.getElementById("snooze-blink");
	if (snoozeBtn) {
		snoozeBtn.addEventListener("click", snoozeBlink);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initReminderPopup);
} else {
	initReminderPopup();
}
