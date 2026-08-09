// Hidden sound player window — file MP3s or procedural cheer fanfare

/** @param {number} volume 0..1 */
function playCheerFanfare(volume) {
	const AudioCtx = window.AudioContext || window.webkitAudioContext;
	if (!AudioCtx) {
		window.popupAPI.notifyAudioFinished();
		return;
	}

	const ctx = new AudioCtx();
	const master = ctx.createGain();
	master.gain.value = Math.min(1, Math.max(0, volume)) * 0.35;
	master.connect(ctx.destination);

	const roots = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0]; // C4–A4
	const major = [0, 4, 7, 12];
	const pentatonic = [0, 2, 4, 7, 9];
	const scale = Math.random() < 0.5 ? major : pentatonic;
	const root = roots[Math.floor(Math.random() * roots.length)];
	const noteCount = 3 + Math.floor(Math.random() * 3); // 3–5
	const stepMs = 90 + Math.floor(Math.random() * 50);
	const noteDur = 0.18 + Math.random() * 0.1;

	const midiOffset = (semitones) => root * Math.pow(2, semitones / 12);

	function playTone(freq, startTime, duration, peak) {
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = Math.random() < 0.65 ? "triangle" : "sine";
		osc.frequency.value = freq;
		gain.gain.setValueAtTime(0.0001, startTime);
		gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.02);
		gain.gain.exponentialRampToValueAtTime(
			0.0001,
			startTime + duration,
		);
		osc.connect(gain);
		gain.connect(master);
		osc.start(startTime);
		osc.stop(startTime + duration + 0.02);
	}

	const t0 = ctx.currentTime + 0.02;
	for (let i = 0; i < noteCount; i++) {
		const deg = scale[Math.min(i, scale.length - 1)];
		const freq = midiOffset(deg);
		const start = t0 + (i * stepMs) / 1000;
		playTone(freq, start, noteDur, 0.7 + Math.random() * 0.25);
		// Soft octave sparkle on last note sometimes
		if (i === noteCount - 1 && Math.random() < 0.7) {
			playTone(freq * 2, start + 0.04, noteDur * 0.7, 0.35);
		}
	}

	// Tiny high "ding" after the arpeggio
	if (Math.random() < 0.85) {
		const dingStart = t0 + (noteCount * stepMs) / 1000 + 0.05;
		playTone(midiOffset(12 + Math.floor(Math.random() * 5)), dingStart, 0.22, 0.45);
	}

	const totalMs =
		noteCount * stepMs + noteDur * 1000 + 350;
	setTimeout(() => {
		void ctx.close().catch(() => {});
		window.popupAPI.notifyAudioFinished();
	}, totalMs);
}

function playFileSound(payload) {
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
}

function initSoundPlayer() {
	window.popupAPI.onPlaySound((payload) => {
		const volume =
			typeof payload?.volume === "number" && Number.isFinite(payload.volume)
				? Math.min(1, Math.max(0, payload.volume))
				: 1;

		if (payload?.mode === "cheer") {
			playCheerFanfare(volume);
			return;
		}

		playFileSound(payload);
	});
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initSoundPlayer);
} else {
	initSoundPlayer();
}
