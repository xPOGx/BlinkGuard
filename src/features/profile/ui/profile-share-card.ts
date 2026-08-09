export type ProfileShareCardInput = {
	brand: string;
	levelLabel: string;
	title: string;
	tier: string;
	blinksLabel: string;
	streakLabel: string;
	dateLabel: string;
	dark: boolean;
};

const WIDTH = 1080;
const HEIGHT = 1350;

function roundRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) {
	const radius = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + radius, y);
	ctx.arcTo(x + w, y, x + w, y + h, radius);
	ctx.arcTo(x + w, y + h, x, y + h, radius);
	ctx.arcTo(x, y + h, x, y, radius);
	ctx.arcTo(x, y, x + w, y, radius);
	ctx.closePath();
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error("Failed to encode profile card"));
				return;
			}
			void blob.arrayBuffer().then((buffer) => {
				resolve(new Uint8Array(buffer));
			}, reject);
		}, "image/png");
	});
}

/** Draw a shareable profile card and return PNG bytes. */
export async function renderProfileShareCard(
	input: ProfileShareCardInput,
): Promise<Uint8Array> {
	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas unavailable");

	const bg0 = input.dark ? "#0f1419" : "#f4f7f5";
	const bg1 = input.dark ? "#1a2330" : "#e7efe9";
	const card = input.dark ? "#18212c" : "#ffffff";
	const border = input.dark ? "#2c3a4a" : "#d5e0d8";
	const muted = input.dark ? "#9db0c0" : "#5f7368";
	const fg = input.dark ? "#eef3f7" : "#1c2a24";
	const accent = input.dark ? "#3dd6c6" : "#0f766e";

	const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
	gradient.addColorStop(0, bg0);
	gradient.addColorStop(1, bg1);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, WIDTH, HEIGHT);

	// Soft diagonal wash
	ctx.fillStyle = input.dark
		? "rgba(61, 214, 198, 0.06)"
		: "rgba(15, 118, 110, 0.07)";
	ctx.beginPath();
	ctx.moveTo(0, 220);
	ctx.lineTo(WIDTH, 80);
	ctx.lineTo(WIDTH, 520);
	ctx.lineTo(0, 680);
	ctx.closePath();
	ctx.fill();

	const pad = 72;
	roundRect(ctx, pad, pad + 40, WIDTH - pad * 2, HEIGHT - pad * 2 - 80, 28);
	ctx.fillStyle = card;
	ctx.fill();
	ctx.strokeStyle = border;
	ctx.lineWidth = 2;
	ctx.stroke();

	let y = pad + 120;
	ctx.fillStyle = accent;
	ctx.font = "600 36px Georgia, 'Times New Roman', serif";
	ctx.fillText(input.brand, pad + 64, y);

	y += 100;
	ctx.fillStyle = muted;
	ctx.font = "500 28px system-ui, sans-serif";
	ctx.fillText(input.tier.toUpperCase(), pad + 64, y);

	y += 90;
	ctx.fillStyle = fg;
	ctx.font = "700 96px Georgia, 'Times New Roman', serif";
	ctx.fillText(input.levelLabel, pad + 64, y);

	y += 80;
	ctx.fillStyle = accent;
	ctx.font = "600 48px Georgia, 'Times New Roman', serif";
	wrapText(ctx, input.title, pad + 64, y, WIDTH - pad * 2 - 128, 58);

	y += estimateLines(ctx, input.title, WIDTH - pad * 2 - 128) * 58 + 80;
	ctx.strokeStyle = border;
	ctx.beginPath();
	ctx.moveTo(pad + 64, y);
	ctx.lineTo(WIDTH - pad - 64, y);
	ctx.stroke();

	y += 70;
	ctx.fillStyle = fg;
	ctx.font = "500 34px system-ui, sans-serif";
	ctx.fillText(input.blinksLabel, pad + 64, y);
	y += 56;
	ctx.fillStyle = muted;
	ctx.fillText(input.streakLabel, pad + 64, y);

	ctx.fillStyle = muted;
	ctx.font = "400 26px system-ui, sans-serif";
	ctx.fillText(input.dateLabel, pad + 64, HEIGHT - pad - 56);

	return canvasToPngBytes(canvas);
}

function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number,
) {
	const words = text.split(/\s+/);
	let line = "";
	let cy = y;
	for (const word of words) {
		const test = line ? `${line} ${word}` : word;
		if (ctx.measureText(test).width > maxWidth && line) {
			ctx.fillText(line, x, cy);
			line = word;
			cy += lineHeight;
		} else {
			line = test;
		}
	}
	if (line) ctx.fillText(line, x, cy);
}

function estimateLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): number {
	const words = text.split(/\s+/);
	let line = "";
	let lines = 1;
	for (const word of words) {
		const test = line ? `${line} ${word}` : word;
		if (ctx.measureText(test).width > maxWidth && line) {
			line = word;
			lines += 1;
		} else {
			line = test;
		}
	}
	return lines;
}
