export type ProfileShareStat = {
	label: string;
	value: string;
};

export type ProfileShareCardInput = {
	brand: string;
	level: number;
	levelLabel: string;
	title?: string | null;
	tier?: string | null;
	desc?: string | null;
	stats?: ProfileShareStat[];
	flairLabel?: string | null;
	dateLabel?: string | null;
	/** 0–1 progress toward next level; omit to hide the bar + ring. */
	progressRatio?: number | null;
	progressCaption?: string | null;
	tagline?: string | null;
	dark: boolean;
};

export type ProfileShareCardResult = {
	bytes: Uint8Array;
	dataUrl: string;
};

/** Visible text blocks used for layout / tests (null or empty omitted). */
export function resolveShareCardContent(input: ProfileShareCardInput): {
	brand: string;
	level: number;
	levelLabel: string;
	tier: string | null;
	title: string | null;
	desc: string | null;
	flair: string | null;
	stats: ProfileShareStat[];
	dateLabel: string | null;
	progressRatio: number | null;
	progressCaption: string | null;
	tagline: string | null;
} {
	const stats = (input.stats ?? []).filter(
		(s) => s.label.trim() && s.value.trim(),
	);

	const ratio =
		typeof input.progressRatio === "number" &&
		Number.isFinite(input.progressRatio)
			? Math.min(1, Math.max(0, input.progressRatio))
			: null;

	return {
		brand: input.brand,
		level: input.level,
		levelLabel: input.levelLabel,
		tier: input.tier?.trim() ? input.tier : null,
		title: input.title?.trim() ? input.title : null,
		desc: input.desc?.trim() ? input.desc : null,
		flair: input.flairLabel?.trim() ? input.flairLabel : null,
		stats,
		dateLabel: input.dateLabel?.trim() ? input.dateLabel : null,
		progressRatio: ratio,
		progressCaption: input.progressCaption?.trim()
			? input.progressCaption
			: null,
		tagline: input.tagline?.trim() ? input.tagline : null,
	};
}

const WIDTH = 1080;
const OUTER_PAD = 44;
const CARD_PAD = 52;
const HEADER_H = 108;

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

function canvasToPng(
	canvas: HTMLCanvasElement,
): Promise<ProfileShareCardResult> {
	const dataUrl = canvas.toDataURL("image/png");
	return new Promise((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (!blob) {
				reject(new Error("Failed to encode profile card"));
				return;
			}
			void blob.arrayBuffer().then((buffer) => {
				resolve({ bytes: new Uint8Array(buffer), dataUrl });
			}, reject);
		}, "image/png");
	});
}

function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number,
	maxLines = 8,
): number {
	const words = text.split(/\s+/);
	let line = "";
	let cy = y;
	let lines = 0;
	for (const word of words) {
		const test = line ? `${line} ${word}` : word;
		if (ctx.measureText(test).width > maxWidth && line) {
			ctx.fillText(line, x, cy);
			line = word;
			cy += lineHeight;
			lines += 1;
			if (lines >= maxLines) {
				return cy - y;
			}
		} else {
			line = test;
		}
	}
	if (line && lines < maxLines) {
		ctx.fillText(line, x, cy);
		lines += 1;
		cy += lineHeight;
	}
	return Math.max(lineHeight, lines * lineHeight);
}

function drawChip(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	opts: { fill: string; stroke: string; fg: string },
): number {
	ctx.font = "600 22px system-ui, sans-serif";
	const padX = 18;
	const tw = ctx.measureText(text).width;
	const w = tw + padX * 2;
	const h = 36;
	roundRect(ctx, x, y - h + 8, w, h, 10);
	ctx.fillStyle = opts.fill;
	ctx.fill();
	ctx.strokeStyle = opts.stroke;
	ctx.lineWidth = 1.5;
	ctx.stroke();
	ctx.fillStyle = opts.fg;
	ctx.fillText(text, x + padX, y);
	return w;
}

function drawProgressRing(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	radius: number,
	ratio: number,
	opts: { track: string; fill: string; fg: string; label: string },
) {
	ctx.beginPath();
	ctx.arc(cx, cy, radius, 0, Math.PI * 2);
	ctx.strokeStyle = opts.track;
	ctx.lineWidth = 14;
	ctx.stroke();

	const start = -Math.PI / 2;
	const end = start + Math.PI * 2 * ratio;
	ctx.beginPath();
	ctx.arc(cx, cy, radius, start, end);
	ctx.strokeStyle = opts.fill;
	ctx.lineCap = "round";
	ctx.lineWidth = 14;
	ctx.stroke();
	ctx.lineCap = "butt";

	ctx.fillStyle = opts.fg;
	ctx.font = "700 34px system-ui, sans-serif";
	ctx.textAlign = "center";
	ctx.fillText(opts.label, cx, cy + 12);
	ctx.textAlign = "start";
}

function paintCard(
	ctx: CanvasRenderingContext2D,
	content: ReturnType<typeof resolveShareCardContent>,
	dark: boolean,
	height: number,
): number {
	const bg0 = dark ? "#0f1419" : "#f4f7f5";
	const bg1 = dark ? "#1a2330" : "#e7efe9";
	const card = dark ? "#18212c" : "#ffffff";
	const border = dark ? "#2c3a4a" : "#d5e0d8";
	const muted = dark ? "#9db0c0" : "#5f7368";
	const fg = dark ? "#eef3f7" : "#1c2a24";
	const accent = dark ? "#3dd6c6" : "#0f766e";
	const chipFill = dark
		? "rgba(61, 214, 198, 0.12)"
		: "rgba(15, 118, 110, 0.1)";
	const chipStroke = dark
		? "rgba(61, 214, 198, 0.45)"
		: "rgba(15, 118, 110, 0.35)";
	const statBg = dark ? "#121a24" : "#f0f5f2";
	const headerFill = dark ? "#14202b" : "#e8f2ed";
	const track = dark ? "#243040" : "#d8e5de";

	const gradient = ctx.createLinearGradient(0, 0, WIDTH, height);
	gradient.addColorStop(0, bg0);
	gradient.addColorStop(1, bg1);
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, WIDTH, height);

	ctx.fillStyle = dark
		? "rgba(61, 214, 198, 0.07)"
		: "rgba(15, 118, 110, 0.08)";
	ctx.beginPath();
	ctx.moveTo(0, 160);
	ctx.lineTo(WIDTH, 40);
	ctx.lineTo(WIDTH, 360);
	ctx.lineTo(0, 480);
	ctx.closePath();
	ctx.fill();

	const orb = ctx.createRadialGradient(
		WIDTH - 160,
		180,
		20,
		WIDTH - 160,
		180,
		260,
	);
	orb.addColorStop(
		0,
		dark ? "rgba(61, 214, 198, 0.2)" : "rgba(15, 118, 110, 0.16)",
	);
	orb.addColorStop(1, "rgba(0,0,0,0)");
	ctx.fillStyle = orb;
	ctx.fillRect(WIDTH - 480, 0, 480, 420);

	const cardX = OUTER_PAD;
	const cardY = OUTER_PAD;
	const cardW = WIDTH - OUTER_PAD * 2;
	const cardH = height - OUTER_PAD * 2;
	roundRect(ctx, cardX, cardY, cardW, cardH, 28);
	ctx.fillStyle = card;
	ctx.fill();
	ctx.strokeStyle = border;
	ctx.lineWidth = 2;
	ctx.stroke();

	ctx.save();
	roundRect(ctx, cardX, cardY, cardW, HEADER_H, 28);
	ctx.clip();
	ctx.fillStyle = headerFill;
	ctx.fillRect(cardX, cardY, cardW, HEADER_H);
	ctx.restore();
	ctx.fillStyle = headerFill;
	ctx.fillRect(cardX, cardY + HEADER_H - 28, cardW, 28);

	const innerX = cardX + CARD_PAD;
	const innerW = cardW - CARD_PAD * 2;

	ctx.fillStyle = accent;
	ctx.font = "600 34px Georgia, 'Times New Roman', serif";
	ctx.fillText(content.brand, innerX, cardY + 68);

	if (content.dateLabel) {
		ctx.font = "500 22px system-ui, sans-serif";
		const dw = ctx.measureText(content.dateLabel).width;
		const chipW = dw + 28;
		const chipX = cardX + cardW - CARD_PAD - chipW;
		roundRect(ctx, chipX, cardY + 38, chipW, 36, 18);
		ctx.fillStyle = chipFill;
		ctx.fill();
		ctx.strokeStyle = chipStroke;
		ctx.lineWidth = 1.5;
		ctx.stroke();
		ctx.fillStyle = muted;
		ctx.fillText(content.dateLabel, chipX + 14, cardY + 62);
	}

	let y = cardY + HEADER_H + CARD_PAD - 4;

	let chipX = innerX;
	if (content.tier) {
		chipX +=
			drawChip(ctx, content.tier.toUpperCase(), chipX, y, {
				fill: chipFill,
				stroke: chipStroke,
				fg: accent,
			}) + 12;
	}
	if (content.flair) {
		drawChip(ctx, content.flair.toUpperCase(), chipX, y, {
			fill: chipFill,
			stroke: chipStroke,
			fg: accent,
		});
	}
	if (content.tier || content.flair) {
		y += 84;
	} else {
		y += 8;
	}

	const ringR = 56;
	const ringCx = innerX + innerW - ringR - 4;
	const levelBaseline = y + 24;
	ctx.fillStyle = fg;
	ctx.font = "700 82px Georgia, 'Times New Roman', serif";
	ctx.fillText(content.levelLabel, innerX, levelBaseline);

	if (content.progressRatio !== null) {
		const ringCy = y + 8;
		drawProgressRing(ctx, ringCx, ringCy, ringR, content.progressRatio, {
			track,
			fill: accent,
			fg,
			label: `${Math.round(content.progressRatio * 100)}%`,
		});

		y = Math.max(levelBaseline, ringCy + ringR) + 28;
		const barW = Math.min(innerW - (ringR * 2 + 48), innerW * 0.58);
		const barH = 12;
		roundRect(ctx, innerX, y, barW, barH, 6);
		ctx.fillStyle = track;
		ctx.fill();
		const fillW = Math.max(8, barW * content.progressRatio);
		roundRect(ctx, innerX, y, fillW, barH, 6);
		ctx.fillStyle = accent;
		ctx.fill();
		y += 34;
	} else {
		y = levelBaseline + 36;
	}

	if (content.progressCaption) {
		ctx.fillStyle = muted;
		ctx.font = "500 24px system-ui, sans-serif";
		ctx.fillText(content.progressCaption, innerX, y);
		y += 34;
	}

	if (content.title) {
		y += 8;
		ctx.fillStyle = accent;
		ctx.font = "600 42px Georgia, 'Times New Roman', serif";
		const titleH = wrapText(ctx, content.title, innerX, y, innerW, 50, 3);
		y += titleH;
	}

	if (content.desc) {
		y += 6;
		ctx.fillStyle = muted;
		ctx.font = "400 26px system-ui, sans-serif";
		const descH = wrapText(ctx, content.desc, innerX, y, innerW, 36, 3);
		y += descH;
	}

	if (content.stats.length > 0) {
		y += 20;
		ctx.strokeStyle = border;
		ctx.beginPath();
		ctx.moveTo(innerX, y);
		ctx.lineTo(innerX + innerW, y);
		ctx.stroke();
		y += 22;

		const cols = Math.min(2, content.stats.length);
		const gap = 16;
		const cellW = (innerW - gap * (cols - 1)) / cols;
		const cellH = 118;
		content.stats.forEach((stat, index) => {
			const col = index % cols;
			const row = Math.floor(index / cols);
			const cx = innerX + col * (cellW + gap);
			const cy = y + row * (cellH + gap);

			roundRect(ctx, cx, cy, cellW, cellH, 18);
			ctx.fillStyle = statBg;
			ctx.fill();
			ctx.strokeStyle = border;
			ctx.lineWidth = 1.5;
			ctx.stroke();

			ctx.fillStyle = accent;
			roundRect(ctx, cx + 18, cy + 22, 10, 10, 3);
			ctx.fill();

			ctx.fillStyle = muted;
			ctx.font = "600 20px system-ui, sans-serif";
			ctx.fillText(stat.label.toUpperCase(), cx + 38, cy + 34);

			ctx.fillStyle = fg;
			ctx.font = "700 40px Georgia, 'Times New Roman', serif";
			ctx.fillText(stat.value, cx + 22, cy + 84);
		});
		const rows = Math.ceil(content.stats.length / cols);
		y += rows * (cellH + gap);
	}

	y += 4;
	ctx.strokeStyle = border;
	ctx.beginPath();
	ctx.moveTo(innerX, y);
	ctx.lineTo(innerX + innerW, y);
	ctx.stroke();
	y += 34;

	ctx.fillStyle = accent;
	ctx.font = "600 22px Georgia, 'Times New Roman', serif";
	ctx.fillText(content.brand, innerX, y);

	if (content.tagline) {
		ctx.fillStyle = muted;
		ctx.font = "400 22px system-ui, sans-serif";
		const tw = ctx.measureText(content.tagline).width;
		ctx.fillText(content.tagline, innerX + innerW - tw, y);
	}

	return y + CARD_PAD + OUTER_PAD;
}

/** Draw a shareable profile card and return PNG bytes + data URL for preview. */
export async function renderProfileShareCard(
	input: ProfileShareCardInput,
): Promise<ProfileShareCardResult> {
	const content = resolveShareCardContent(input);
	const draft = document.createElement("canvas");
	draft.width = WIDTH;
	draft.height = 2200;
	const draftCtx = draft.getContext("2d");
	if (!draftCtx) throw new Error("Canvas unavailable");

	const contentBottom = paintCard(draftCtx, content, input.dark, draft.height);
	const height = Math.max(
		Math.ceil(contentBottom),
		OUTER_PAD * 2 + HEADER_H + 200,
	);

	const canvas = document.createElement("canvas");
	canvas.width = WIDTH;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas unavailable");
	paintCard(ctx, content, input.dark, height);

	return canvasToPng(canvas);
}
