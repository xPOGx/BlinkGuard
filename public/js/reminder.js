// Blink / starting / stopped reminder popups

function snoozeBlink() {
	window.popupAPI.snoozeBlink();
}

function applyBlinkClickThrough(enabled) {
	const snoozeBtn = document.getElementById("snooze-blink");
	if (!snoozeBtn) return;
	snoozeBtn.hidden = Boolean(enabled);
	snoozeBtn.style.display = enabled ? "none" : "";
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
	window.popupAPI.onBlinkClickThrough(applyBlinkClickThrough);

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
