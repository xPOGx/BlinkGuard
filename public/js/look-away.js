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

function initLookAwayPopup() {
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
}

function initLookAway() {
	updateColors({
		background: "#1E1E1E",
		text: "#FFFFFF",
		transparency: 0.3,
	});

	initLookAwayPopup();
	updateColors({
		background: "transparent",
		text: "#FFFFFF",
		transparency: 0.3,
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initLookAway);
} else {
	initLookAway();
}
