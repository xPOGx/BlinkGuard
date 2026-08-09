// Cheer toast: confetti burst around the celebration message

const COLORS = [
	"#fbbf24",
	"#f59e0b",
	"#34d399",
	"#60a5fa",
	"#f472b6",
	"#a78bfa",
	"#fde68a",
	"#fb7185",
];

function spawnParticles(stage, count) {
	const cx = stage.clientWidth / 2;
	const cy = stage.clientHeight / 2;

	for (let i = 0; i < count; i++) {
		const el = document.createElement("span");
		el.className = "cheer-particle";
		el.setAttribute("aria-hidden", "true");

		const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.6;
		const dist = 36 + Math.random() * 72;
		const dx = Math.cos(angle) * dist;
		const dy = Math.sin(angle) * dist - 10 - Math.random() * 24;
		const size = 4 + Math.floor(Math.random() * 5);
		const duration = 0.85 + Math.random() * 0.55;
		const delay = Math.random() * 0.18;
		const isRound = Math.random() < 0.35;

		el.style.left = `${cx + (Math.random() - 0.5) * 12}px`;
		el.style.top = `${cy + (Math.random() - 0.5) * 8}px`;
		el.style.width = `${isRound ? size : size + 2}px`;
		el.style.height = `${isRound ? size : Math.max(3, size - 1)}px`;
		el.style.borderRadius = isRound ? "50%" : "2px";
		el.style.background = COLORS[Math.floor(Math.random() * COLORS.length)];
		el.style.setProperty("--dx", `${dx.toFixed(1)}px`);
		el.style.setProperty("--dy", `${dy.toFixed(1)}px`);
		el.style.setProperty("--rot", `${Math.floor(Math.random() * 360 - 180)}deg`);
		el.style.animationDuration = `${duration}s`;
		el.style.animationDelay = `${delay}s`;

		stage.appendChild(el);
		el.addEventListener(
			"animationend",
			() => {
				el.remove();
			},
			{ once: true },
		);
	}
}

function initCheer() {
	const stage = document.getElementById("cheer-stage");
	if (!stage) return;
	spawnParticles(stage, 22 + Math.floor(Math.random() * 10));
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", initCheer);
} else {
	initCheer();
}
