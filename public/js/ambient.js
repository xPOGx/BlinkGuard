// Ambient peripheral glow: theme tokens only; no interactive chrome.

function initAmbient() {
	if (typeof updateColors === "function") {
		updateColors(POPUP_THEME_DEFAULTS);
	}
	if (window.popupAPI && typeof window.popupAPI.onUpdateColors === "function") {
		window.popupAPI.onUpdateColors(updateColors);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initAmbient);
} else {
	initAmbient();
}
