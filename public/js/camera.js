// Camera visualization window

let lastFaceData = null;
let lastBlinkTime = 0;
let blinkDisplayTimer = null;
let currentThreshold = 0.2;
let thresholdUpdateTimer = null;

function updateInfoDisplay(eyeSize, isBlinking = false) {
	const info = document.getElementById("info");
	const currentValues = document.getElementById("current-values");

	if (info) {
		info.innerHTML = `
      Your eye size is continously being calculated, once it drops significantly below your baseline (average eye size) a blink is detected
    `;
		info.style.background = isBlinking ? "rgba(0, 255, 0, 0.5)" : "rgba(0, 0, 0, 0.4)";
	}

	if (currentValues) {
		const eyeSizeText = eyeSize !== null ? eyeSize.toFixed(3) : "0.000";
		currentValues.innerHTML = `
      <strong>Current:</strong> Eye size: ${eyeSizeText}
      <br>
      <strong>Baseline:</strong> ${lastFaceData && lastFaceData.baseline ? lastFaceData.baseline.toFixed(3) : "Building..."}
      <br>
      <strong>Status:</strong> ${lastFaceData && lastFaceData.blink_phase ? lastFaceData.blink_phase : "monitoring"}
    `;
		currentValues.style.background = isBlinking ? "rgba(0, 255, 0, 0.5)" : "rgba(0, 0, 0, 0.4)";
	}
}

function resetBlinkDisplay() {
	if (lastFaceData && lastFaceData.faceDetected) {
		const eyeSize = lastFaceData.ear || 0;
		const status = document.getElementById("status");
		if (status) {
			status.textContent = "Eye size: " + eyeSize.toFixed(3);
			status.style.background = "rgba(0, 0, 0, 0.4)";
		}
		updateInfoDisplay(eyeSize);
	}
}

function drawOverlays(faceData) {
	const canvas = document.getElementById("canvas");
	if (!canvas || !faceData) return;

	const ctx = canvas.getContext("2d");
	if (faceData.faceDetected) {
		ctx.save();
		ctx.strokeStyle = "#00FF00";
		ctx.lineWidth = 2;

		ctx.strokeRect(
			faceData.faceRect.x * canvas.width,
			faceData.faceRect.y * canvas.height,
			faceData.faceRect.width * canvas.width,
			faceData.faceRect.height * canvas.height,
		);

		if (faceData.eyeLandmarks) {
			ctx.fillStyle = "#00FF00";
			faceData.eyeLandmarks.forEach((point) => {
				ctx.beginPath();
				ctx.arc(point.x * canvas.width, point.y * canvas.height, 2, 0, Math.PI * 2);
				ctx.fill();
			});
		}
		ctx.restore();

		const timeSinceLastBlink = Date.now() - lastBlinkTime;
		const shouldShowBlink = timeSinceLastBlink < 350;

		const eyeSize = faceData.ear || 0;
		const isBlinking = faceData.blink || shouldShowBlink;

		const status = document.getElementById("status");
		if (status) {
			status.textContent = isBlinking ? "BLINK DETECTED!" : "Eye size: " + eyeSize.toFixed(3);
			status.style.background = isBlinking ? "rgba(0, 255, 0, 0.5)" : "rgba(0, 0, 0, 0.4)";
		}

		updateInfoDisplay(eyeSize, isBlinking);
	} else {
		const status = document.getElementById("status");
		if (status) {
			status.textContent = "No face detected";
			status.style.background = "rgba(255, 0, 0, 0.5)";
		}
		updateInfoDisplay(null);
	}
}

function initCameraPopup() {
	window.popupAPI.onFaceTrackingData((data) => {
		lastFaceData = data;

		const timeSinceLastBlink = Date.now() - lastBlinkTime;
		const shouldShowBlink = timeSinceLastBlink < 350;

		if (data.faceDetected) {
			const eyeSize = data.ear || 0;
			const isBlinking = data.blink || shouldShowBlink;

			const status = document.getElementById("status");
			if (status) {
				status.textContent = isBlinking ? "BLINK DETECTED!" : "Eye size: " + eyeSize.toFixed(3);
				status.style.background = isBlinking ? "rgba(0, 255, 0, 0.5)" : "rgba(0, 0, 0, 0.4)";
			}

			updateInfoDisplay(eyeSize, isBlinking);
		}
	});

	window.popupAPI.onBlinkDetected((blinkData) => {
		lastBlinkTime = Date.now();

		if (blinkDisplayTimer) {
			clearTimeout(blinkDisplayTimer);
		}

		if (lastFaceData && lastFaceData.faceDetected) {
			const status = document.getElementById("status");
			if (status) {
				status.textContent = "BLINK DETECTED!";
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
				status.textContent = "Error: Failed to process video stream";
				status.style.background = "rgba(255, 0, 0, 0.5)";
			}
		}
	});

	window.popupAPI.requestVideoStream();
	updateInfoDisplay(null);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initCameraPopup);
} else {
	initCameraPopup();
}
