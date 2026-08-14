/**
 * Compose BlinkGuard product intro scenes and encode a silent 1080p MP4.
 *
 * Inputs: docs/screenshots/*.png + assets/icons/icon.png
 * Outputs: docs/intro/blinkguard-intro.mp4, docs/intro/poster.png
 *
 * Requires ffmpeg on PATH (Windows: winget FFmpeg). Usage:
 *   npm run generate:intro-video
 */
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const shots = path.join(root, "docs", "screenshots");
const iconPath = path.join(root, "assets", "icons", "icon.png");
const outDir = path.join(root, "docs", "intro");
const scratchDir = path.join(__dirname, "_scratch");

const W = 1920;
const H = 1080;
const FPS = 30;
const FADE = 0.5;
const TITLE_SEC = 3.4;
const SCENE_SEC = 3.3;
const POPUPS_SEC = 3.4;
const END_SEC = 3.8;

const MINT = "rgb(165,242,208)";
const WHITE = "rgb(248,252,252)";
const MUTED = "rgba(165,242,208,0.72)";

const SCENES = [
	{ id: "00-title", seconds: TITLE_SEC },
	{ id: "01-reminders", seconds: SCENE_SEC },
	{ id: "02-camera", seconds: SCENE_SEC },
	{ id: "03-popups", seconds: POPUPS_SEC },
	{ id: "04-progress", seconds: SCENE_SEC },
	{ id: "05-end", seconds: END_SEC },
];

function ffmpegBin() {
	try {
		const cmd = process.platform === "win32" ? "where.exe" : "which";
		const out = execFileSync(cmd, ["ffmpeg"], { encoding: "utf8" });
		return out.split(/\r?\n/).find((line) => line.trim()) || "ffmpeg";
	} catch {
		return "ffmpeg";
	}
}

function run(bin, args) {
	return new Promise((resolve, reject) => {
		const child = spawn(bin, args, { stdio: "inherit", windowsHide: true });
		child.on("error", reject);
		child.on("exit", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${path.basename(bin)} exited ${code}`));
		});
	});
}

function framesFor(seconds) {
	return Math.round(seconds * FPS);
}

async function sceneBackground() {
	const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#124e54"/>
      <stop offset="50%" stop-color="#0a2e34"/>
      <stop offset="100%" stop-color="#06141a"/>
    </linearGradient>
    <radialGradient id="glow" cx="48%" cy="42%" r="62%">
      <stop offset="0%" stop-color="rgba(165,242,208,0.10)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="4" fill="${MINT}" opacity="0.85"/>
</svg>`);
	return sharp(svg).png().toBuffer();
}

function captionSvg(title, subtitle) {
	const sub = subtitle
		? `<text x="960" y="118" text-anchor="middle"
      font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="${MUTED}">${subtitle}</text>`
		: "";
	return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="160">
  <text x="960" y="78" text-anchor="middle"
    font-family="Segoe UI, Arial, sans-serif" font-size="40" font-weight="700" fill="${WHITE}">${title}</text>
  ${sub}
</svg>`);
}

async function punchPureBlack(filePath) {
	const { data, info } = await sharp(filePath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	for (let i = 0; i < data.length; i += 4) {
		if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) data[i + 3] = 0;
	}
	return sharp(data, {
		raw: { width: info.width, height: info.height, channels: 4 },
	})
		.png()
		.toBuffer();
}

async function windowCard(src, maxW, maxH, radius = 18) {
	const input = Buffer.isBuffer(src) ? src : await sharp(src).png().toBuffer();
	const fitted = await sharp(input)
		.resize(maxW, maxH, { fit: "inside" })
		.png()
		.toBuffer();
	const meta = await sharp(fitted).metadata();
	const w = meta.width;
	const h = meta.height;
	const mask = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`,
	);
	const rounded = await sharp(fitted)
		.composite([{ input: mask, blend: "dest-in" }])
		.png()
		.toBuffer();

	const pad = 52;
	const cw = w + pad * 2;
	const ch = h + pad * 2;
	const shadowSvg = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${cw}" height="${ch}">
  <rect x="${pad + 4}" y="${pad + 12}" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="rgba(0,0,0,0.52)"/>
</svg>`,
	);
	const shadow = await sharp(shadowSvg).blur(18).png().toBuffer();
	return sharp({
		create: {
			width: cw,
			height: ch,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		},
	})
		.composite([
			{ input: shadow, left: 0, top: 0 },
			{ input: rounded, left: pad, top: pad },
		])
		.png()
		.toBuffer({ resolveWithObject: true });
}

async function place(base, overlay, left, top) {
	return sharp(base)
		.composite([{ input: overlay, left, top }])
		.png()
		.toBuffer();
}

async function placeCentered(base, overlay, top) {
	const over = await sharp(overlay).metadata();
	const left = Math.round((W - over.width) / 2);
	return place(base, overlay, left, top);
}

async function featureScene(shotFile, title, subtitle) {
	let bg = await sceneBackground();
	const cap = await sharp(captionSvg(title, subtitle)).png().toBuffer();
	bg = await place(bg, cap, 0, 12);
	const card = await windowCard(path.join(shots, shotFile), 1580, 860);
	const top = Math.round(128 + (H - 128 - card.info.height) / 2);
	return placeCentered(bg, card.data, top);
}

async function titleScene() {
	let bg = await sceneBackground();
	const iconSize = 208;
	const gap = 48;
	const textW = 760;
	const groupW = iconSize + gap + textW;
	const groupX = Math.round((W - groupW) / 2);
	const groupY = Math.round((H - iconSize) / 2) - 12;

	const ring = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="${iconSize + 36}" height="${iconSize + 36}">
  <circle cx="${(iconSize + 36) / 2}" cy="${(iconSize + 36) / 2}" r="${iconSize / 2 + 8}"
    fill="none" stroke="${MINT}" stroke-width="2" opacity="0.35"/>
</svg>`,
	);
	bg = await place(bg, await sharp(ring).png().toBuffer(), groupX - 18, groupY - 18);

	const icon = await sharp(iconPath)
		.resize(iconSize, iconSize)
		.png()
		.toBuffer();
	bg = await place(bg, icon, groupX, groupY);

	const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${textW}" height="${iconSize}">
  <text x="0" y="102" font-family="Segoe UI, Arial, sans-serif" font-size="84" font-weight="700" fill="${WHITE}">BlinkGuard</text>
  <rect x="2" y="118" width="132" height="3" rx="1.5" fill="${MINT}"/>
  <text x="0" y="162" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="${MINT}">Local eye care for long screen days</text>
</svg>`);
	return place(bg, await sharp(text).png().toBuffer(), groupX + iconSize + gap, groupY);
}

async function popupsScene() {
	let bg = await sceneBackground();
	const cap = await sharp(
		captionSvg("Exercises and look-away breaks", "Gentle popups on your desktop"),
	).png().toBuffer();
	bg = await place(bg, cap, 0, 12);

	const blinkBuf = await sharp(await punchPureBlack(path.join(shots, "popup-blink.png")))
		.trim({ threshold: 0 })
		.png()
		.toBuffer();
	const exerciseBuf = await sharp(
		await punchPureBlack(path.join(shots, "popup-exercise.png")),
	)
		.trim({ threshold: 0 })
		.png()
		.toBuffer();

	const blink = await windowCard(blinkBuf, 920, 420, 22);
	const exercise = await windowCard(exerciseBuf, 980, 560, 22);
	const gap = 28;
	const totalW = blink.info.width + gap + exercise.info.width;
	const startX = Math.round((W - totalW) / 2);
	const rowTop = 188;
	bg = await place(bg, blink.data, startX, rowTop + 48);
	bg = await place(
		bg,
		exercise.data,
		startX + blink.info.width + gap,
		rowTop,
	);
	return bg;
}

async function endScene() {
	let bg = await sceneBackground();
	const iconSize = 176;
	const icon = await sharp(iconPath).resize(iconSize, iconSize).png().toBuffer();
	bg = await placeCentered(bg, icon, 268);

	const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="420">
  <text x="960" y="86" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
    font-size="72" font-weight="700" fill="${WHITE}">BlinkGuard</text>
  <text x="960" y="148" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
    font-size="30" fill="${MINT}">On-device. No account. Free.</text>
  <text x="960" y="214" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
    font-size="26" fill="${MUTED}">Windows &amp; macOS · camera optional</text>
  <text x="960" y="286" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
    font-size="28" fill="${WHITE}">github.com/xpogx-org/BlinkGuard</text>
</svg>`);
	return place(bg, await sharp(text).png().toBuffer(), 0, 460);
}

function xfadeOffsets(durations, fade) {
	const offsets = [];
	let sum = 0;
	for (let i = 0; i < durations.length - 1; i++) {
		sum += durations[i];
		offsets.push(Number((sum - fade * (i + 1)).toFixed(3)));
	}
	return offsets;
}

async function encodeClip(ffmpeg, pngPath, clipPath, seconds) {
	const n = framesFor(seconds);
	// Upscale before zoompan so the slow Ken Burns crop stays sharp.
	await run(ffmpeg, [
		"-y",
		"-hide_banner",
		"-loglevel",
		"error",
		"-stats",
		"-loop",
		"1",
		"-i",
		pngPath,
		"-vf",
		`scale=3840:2160,zoompan=z='min(zoom+0.0005,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${n}:s=${W}x${H}:fps=${FPS},format=yuv420p`,
		"-frames:v",
		String(n),
		"-an",
		"-c:v",
		"libx264",
		"-preset",
		"ultrafast",
		"-crf",
		"16",
		clipPath,
	]);
}

async function concatClips(ffmpeg, clips, durations, outPath) {
	const offsets = xfadeOffsets(durations, FADE);
	const total = durations.reduce((a, b) => a + b, 0) - FADE * (clips.length - 1);
	let filter = "";
	let last = "0:v";
	for (let i = 0; i < clips.length - 1; i++) {
		const nextIn = `${i + 1}:v`;
		const out = i === clips.length - 2 ? "xf" : `v${i}`;
		filter += `[${last}][${nextIn}]xfade=transition=fade:duration=${FADE}:offset=${offsets[i]}[${out}];`;
		last = out;
	}
	filter += `[xf]fade=t=in:st=0:d=0.35,fade=t=out:st=${(total - 0.45).toFixed(3)}:d=0.45,format=yuv420p[out]`;

	const args = ["-y", "-hide_banner", "-loglevel", "error", "-stats"];
	for (const clip of clips) args.push("-i", clip);
	args.push(
		"-filter_complex",
		filter,
		"-map",
		"[out]",
		"-an",
		"-c:v",
		"libx264",
		"-preset",
		"medium",
		"-crf",
		"21",
		"-pix_fmt",
		"yuv420p",
		"-movflags",
		"+faststart",
		outPath,
	);
	await run(ffmpeg, args);
}

async function main() {
	for (const rel of [
		"settings-reminders.png",
		"settings-camera.png",
		"settings-progress.png",
		"popup-blink.png",
		"popup-exercise.png",
	]) {
		const file = path.join(shots, rel);
		if (!fs.existsSync(file)) {
			console.error(`Missing screenshot: ${file}`);
			process.exit(1);
		}
	}
	if (!fs.existsSync(iconPath)) {
		console.error(`Missing icon: ${iconPath}`);
		process.exit(1);
	}

	fs.mkdirSync(scratchDir, { recursive: true });
	fs.mkdirSync(outDir, { recursive: true });

	console.log("Compositing scenes…");
	const rendered = {
		"00-title": await titleScene(),
		"01-reminders": await featureScene(
			"settings-reminders.png",
			"Blink reminders, on your interval",
			"Timer mode, or only when you have not blinked",
		),
		"02-camera": await featureScene(
			"settings-camera.png",
			"Optional on-device blink detection",
			"Frames stay on this PC — nothing is uploaded",
		),
		"03-popups": await popupsScene(),
		"04-progress": await featureScene(
			"settings-progress.png",
			"Goals, stats, and rewards",
			"Track streaks without an account",
		),
		"05-end": await endScene(),
	};

	const pngPaths = [];
	for (const scene of SCENES) {
		const pngPath = path.join(scratchDir, `${scene.id}.png`);
		await sharp(rendered[scene.id]).png().toFile(pngPath);
		pngPaths.push(pngPath);
		console.log(`  ${path.relative(root, pngPath)}`);
	}

	const posterPath = path.join(outDir, "poster.png");
	await sharp(rendered["00-title"]).resize(1280, 720).png().toFile(posterPath);

	const ffmpeg = ffmpegBin();
	console.log(`Encoding clips with ${ffmpeg}`);
	const clipPaths = [];
	for (let i = 0; i < SCENES.length; i++) {
		const clipPath = path.join(scratchDir, `${SCENES[i].id}.mp4`);
		console.log(`  ${SCENES[i].id} (${SCENES[i].seconds}s)`);
		await encodeClip(ffmpeg, pngPaths[i], clipPath, SCENES[i].seconds);
		clipPaths.push(clipPath);
	}

	const mp4Path = path.join(outDir, "blinkguard-intro.mp4");
	console.log("Concatenating…");
	await concatClips(
		ffmpeg,
		clipPaths,
		SCENES.map((s) => s.seconds),
		mp4Path,
	);

	const stat = fs.statSync(mp4Path);
	const mb = (stat.size / (1024 * 1024)).toFixed(1);
	console.log(`Wrote ${path.relative(root, mp4Path)} (${mb} MB)`);
	console.log(`Wrote ${path.relative(root, posterPath)}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
