(function initCalibrationNudge() {
	const reason =
		new URLSearchParams(window.location.search).get("reason") === "drift"
			? "drift"
			: "stale";
	const key = `popup.calibrationNudge.${reason}`;
	const el = document.getElementById("calibration-nudge");
	if (!el) return;
	el.setAttribute("data-i18n", key);
	const title = document.querySelector("title");
	if (title) title.setAttribute("data-i18n", key);
})();
