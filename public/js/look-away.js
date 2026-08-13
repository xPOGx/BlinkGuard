// Look-away / 20-20-20 popup

function readDurationSeconds() {
	const params = new URLSearchParams(window.location.search);
	const raw = Number.parseInt(params.get("duration") || "20", 10);
	if (!Number.isFinite(raw) || raw < 1) return 20;
	return raw;
}

function skipLookAway() {
	window.popupAPI.skipLookAway();
	window.close();
}

function snoozeLookAway() {
	window.popupAPI.snoozeLookAway();
	window.close();
}

function applyLookAwayClickThrough(enabled) {
	const a11y = window.__popupA11y;
	const root = document.getElementById("container");
	const actions = document.querySelector(".look-away-buttons");
	const snoozeBtn = document.querySelector(".look-away-button.snooze");
	if (!a11y || !root) return;

	a11y.setActionsHidden(actions, enabled);
	if (enabled) {
		a11y.teardownInteractiveDialog(root);
		return;
	}
	a11y.mountInteractiveDialog({
		root: root,
		labelledById: "look-away-title",
		primaryEl: snoozeBtn,
		onEscape: snoozeLookAway,
	});
}

function initLookAwayPopup() {
	const titleEl = document.getElementById("look-away-title");
	const hintEl = document.getElementById("look-away-hint");
	window.popupAPI.onUpdateLookAwayCopy((copy) => {
		if (titleEl && typeof copy?.title === "string") {
			titleEl.textContent = copy.title;
		}
		if (hintEl && typeof copy?.hint === "string") {
			hintEl.textContent = copy.hint;
		}
	});

	const countdownEl = document.getElementById("countdown");
	let remaining = readDurationSeconds();

	if (countdownEl) {
		countdownEl.textContent = String(remaining);
	}

	const tick = window.setInterval(() => {
		remaining -= 1;
		if (countdownEl) {
			countdownEl.textContent = String(Math.max(0, remaining));
		}
		if (remaining <= 0) {
			window.clearInterval(tick);
		}
	}, 1000);

	const skipBtn = document.querySelector(".look-away-button.skip");
	const snoozeBtn = document.querySelector(".look-away-button.snooze");

	if (skipBtn) {
		skipBtn.addEventListener("click", skipLookAway);
	}
	if (snoozeBtn) {
		snoozeBtn.addEventListener("click", snoozeLookAway);
	}

	window.popupAPI.onBlinkClickThrough(applyLookAwayClickThrough);
}

function initLookAway() {
	updateColors({
		background: "#0F172A",
		text: "#F8FAFC",
		transparency: 0.15,
	});

	initLookAwayPopup();
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initLookAway);
} else {
	initLookAway();
}
