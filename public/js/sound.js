// Hidden sound player window

function initSoundPlayer() {
	window.popupAPI.onPlaySound((payload) => {
		const audio = document.getElementById("audio");
		if (!audio || !payload?.path) {
			window.popupAPI.notifyAudioFinished();
			return;
		}

		const volume =
			typeof payload.volume === "number" && Number.isFinite(payload.volume)
				? Math.min(1, Math.max(0, payload.volume))
				: 1;

		audio.src = payload.path;
		audio.volume = volume;

		audio.addEventListener(
			"ended",
			() => {
				window.popupAPI.notifyAudioFinished();
			},
			{ once: true },
		);

		audio.play().catch((error) => {
			console.error("Error playing sound:", error);
			window.popupAPI.notifyAudioFinished();
		});
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initSoundPlayer);
} else {
	initSoundPlayer();
}
