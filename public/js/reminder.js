// Blink / starting / stopped reminder popups

function snoozeBlink() {
	window.popupAPI.snoozeBlink();
}

function applyBlinkClickThrough(enabled) {
	const a11y = window.__popupA11y;
	const root = document.getElementById("blink");
	const snoozeBtn = document.getElementById("snooze-blink");
	if (!a11y || !snoozeBtn) return;

	a11y.setActionsHidden(snoozeBtn, enabled);
	if (enabled || !root) {
		if (root) a11y.teardownInteractiveDialog(root);
		return;
	}
	a11y.mountInteractiveDialog({
		root: root,
		labelledById: "blink-title",
		primaryEl: snoozeBtn,
		onEscape: snoozeBlink,
	});
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
