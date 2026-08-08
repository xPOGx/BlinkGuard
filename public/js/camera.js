// Camera visualization window

let lastFaceData = null;
let lastBlinkTime = 0;
let blinkDisplayTimer = null;
let currentThreshold = 0.2;
let thresholdUpdateTimer = null;

function tr(key, vars) {
	if (window.__i18n && typeof window.__i18n.t === "function") {
		return window.__i18n.t(key, vars);
	}
	return key;
}

function setFaceMissingOverlay(visible, faceStatus) {
	const overlay = document.getElementById("face-missing-overlay");
	const hint = document.getElementById("face-missing-hint");
	if (!overlay) return;

	if (visible) {
		overlay.hidden = false;
		if (hint) {
			const hintKey =
				faceStatus === "too_far"
					? "popup.camera.hintTooFar"
					: "popup.camera.hintNone";
			hint.textContent = tr(hintKey);
			hint.setAttribute("data-i18n", hintKey);
		}
	} else {
		overlay.hidden = true;
	}
}

function updateInfoDisplay(eyeSize, isBlinking = false) {
	const info = document.getElementById("info");
	const currentValues = document.getElementById("current-values");

	if (info) {
		info.textContent = tr("popup.camera.infoLive");
		info.style.background = isBlinking ? "rgba(0, 255, 0, 0.5)" : "rgba(0, 0, 0, 0.4)";
	}

	if (currentValues) {
		const eyeSizeText = eyeSize !== null ? eyeSize.toFixed(3) : "0.000";
		const baseline =
			lastFaceData && lastFaceData.baseline
				? lastFaceData.baseline.toFixed(3)
				: tr("popup.camera.building");
		const statusText =
			lastFaceData && lastFaceData.blink_phase
				? lastFaceData.blink_phase
				: tr("popup.camera.monitoring");
		currentValues.innerHTML =
			"<strong>" +
			tr("popup.camera.current") +
			"</strong> " +
			tr("popup.camera.eyeSize", { value: eyeSizeText }) +
			"<br><strong>" +
			tr("popup.camera.baseline") +
			"</strong> " +
			baseline +
			"<br><strong>" +
			tr("popup.camera.status") +
			"</strong> " +
			statusText;
		currentValues.style.background = isBlinking ? "rgba(0, 255, 0, 0.5)" : "rgba(0, 0, 0, 0.4)";
	}
}

function resetBlinkDisplay() {
	if (lastFaceData && lastFaceData.faceDetected) {
		const eyeSize = lastFaceData.ear || 0;
		const status = document.getElementById("status");
		if (status) {
			status.textContent = tr("popup.camera.eyeSize", {
				value: eyeSize.toFixed(3),
			});
			status.style.background = "rgba(0, 0, 0, 0.4)";
		}
		updateInfoDisplay(eyeSize);
	}
}

function drawFaceRect(ctx, canvas, faceRect, strokeStyle) {
	if (!faceRect || !faceRect.width || !faceRect.height) return;
	ctx.save();
	ctx.strokeStyle = strokeStyle;
	ctx.lineWidth = 2;
	ctx.strokeRect(
		faceRect.x * canvas.width,
		faceRect.y * canvas.height,
		faceRect.width * canvas.width,
		faceRect.height * canvas.height,
	);
	ctx.restore();
}

function drawOverlays(faceData) {
	const canvas = document.getElementById("canvas");
	if (!canvas || !faceData) return;

	const ctx = canvas.getContext("2d");
	if (faceData.faceDetected) {
		drawFaceRect(ctx, canvas, faceData.faceRect, "#00FF00");

		if (faceData.eyeLandmarks) {
			ctx.save();
			ctx.fillStyle = "#00FF00";
			faceData.eyeLandmarks.forEach((point) => {
				ctx.beginPath();
				ctx.arc(point.x * canvas.width, point.y * canvas.height, 2, 0, Math.PI * 2);
				ctx.fill();
			});
			ctx.restore();
		}

		const timeSinceLastBlink = Date.now() - lastBlinkTime;
		const shouldShowBlink = timeSinceLastBlink < 350;

		const eyeSize = faceData.ear || 0;
		const isBlinking = faceData.blink || shouldShowBlink;

		const status = document.getElementById("status");
		if (status) {
			status.textContent = isBlinking
				? tr("popup.camera.blinkDetected")
				: tr("popup.camera.eyeSize", { value: eyeSize.toFixed(3) });
			status.style.background = isBlinking ? "rgba(0, 255, 0, 0.5)" : "rgba(0, 0, 0, 0.4)";
		}

		updateInfoDisplay(eyeSize, isBlinking);
		setFaceMissingOverlay(false);
	} else {
		if (faceData.faceStatus === "too_far") {
			drawFaceRect(ctx, canvas, faceData.faceRect, "#FACC15");
		}

		const status = document.getElementById("status");
		if (status) {
			status.textContent = tr("popup.camera.noFace");
			status.style.background = "rgba(255, 0, 0, 0.5)";
		}
		updateInfoDisplay(null);
		setFaceMissingOverlay(true, faceData.faceStatus || "none");
	}
}

function applyFaceTrackingUi(data) {
	const timeSinceLastBlink = Date.now() - lastBlinkTime;
	const shouldShowBlink = timeSinceLastBlink < 350;

	if (data.faceDetected) {
		const eyeSize = data.ear || 0;
		const isBlinking = data.blink || shouldShowBlink;

		const status = document.getElementById("status");
		if (status) {
			status.textContent = isBlinking
				? tr("popup.camera.blinkDetected")
				: tr("popup.camera.eyeSize", { value: eyeSize.toFixed(3) });
			status.style.background = isBlinking
				? "rgba(0, 255, 0, 0.5)"
				: "rgba(0, 0, 0, 0.4)";
		}

		updateInfoDisplay(eyeSize, isBlinking);
		setFaceMissingOverlay(false);
	} else {
		const status = document.getElementById("status");
		if (status) {
			status.textContent = tr("popup.camera.noFace");
			status.style.background = "rgba(255, 0, 0, 0.5)";
		}
		updateInfoDisplay(null);
		setFaceMissingOverlay(true, data.faceStatus || "none");
	}
}

function initCameraPopup() {
	window.popupAPI.onFaceTrackingData((data) => {
		lastFaceData = data;
		applyFaceTrackingUi(data);
	});

	window.popupAPI.onBlinkDetected((blinkData) => {
		lastBlinkTime = Date.now();

		if (blinkDisplayTimer) {
			clearTimeout(blinkDisplayTimer);
		}

		if (lastFaceData && lastFaceData.faceDetected) {
			const status = document.getElementById("status");
			if (status) {
				status.textContent = tr("popup.camera.blinkDetected");
				status.style.background = "rgba(0, 255, 0, 0.5)";
			}

			updateInfoDisplay(blinkData.ear, true);
		}

		blinkDisplayTimer = setTimeout(resetBlinkDisplay, 350);
	});

	window.popupAPI.onThresholdUpdated((newThreshold) => {
		if (thresholdUpdateTimer) {
			clearTimeout(thresholdUpdateTimer);
		}

		thresholdUpdateTimer = setTimeout(() => {
			currentThreshold = newThreshold;
			updateInfoDisplay(lastFaceData ? lastFaceData.ear : null);
		}, 200);
	});

	window.popupAPI.onVideoStream((streamData) => {
		try {
			const canvas = document.getElementById("canvas");
			if (canvas) {
				const ctx = canvas.getContext("2d");
				const img = new window.Image();
				img.onload = function () {
					canvas.width = img.width;
					canvas.height = img.height;
					ctx.drawImage(img, 0, 0, img.width, img.height);
					drawOverlays(lastFaceData);
				};
				img.src = "data:image/jpeg;base64," + streamData;
			}
		} catch (error) {
			console.error("Error handling video stream:", error);
			const status = document.getElementById("status");
			if (status) {
				status.textContent = tr("popup.camera.streamError");
				status.style.background = "rgba(255, 0, 0, 0.5)";
			}
		}
	});

	if (window.__i18n) {
		window.__i18n.onApply = function () {
			updateInfoDisplay(lastFaceData ? lastFaceData.ear : null);
			if (lastFaceData && !lastFaceData.faceDetected) {
				setFaceMissingOverlay(true, lastFaceData.faceStatus || "none");
			}
		};
	}

	window.popupAPI.requestVideoStream();
	updateInfoDisplay(null);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initCameraPopup);
} else {
	initCameraPopup();
}
