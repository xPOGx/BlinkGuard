// Hidden sound player window

function initSoundPlayer() {
	window.popupAPI.onPlaySound((soundPath) => {
		console.log("Sound player received path:", soundPath);
		const audio = document.getElementById("audio");
		if (audio) {
			audio.src = soundPath;

			audio.addEventListener("ended", () => {
				window.popupAPI.notifyAudioFinished();
			});

			audio.play().catch((error) => {
				console.error("Error playing sound:", error);
				window.popupAPI.notifyAudioFinished();
			});
		}
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initSoundPlayer);
} else {
	initSoundPlayer();
}
