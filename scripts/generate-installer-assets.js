/**
 * Generate NSIS installer bitmaps for electron-builder.
 *
 * Outputs (24-bit BMP, committed under build/):
 *   - installerSidebar.bmp / uninstallerSidebar.bmp — 164×314
 *   - installerHeader.bmp — 150×57
 *
 * Usage: node scripts/generate-installer-assets.js
 *
 * Brand colors match the app icon (dark teal) and settings chrome (slate + teal).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "build");
const iconPath = path.join(root, "assets", "icons", "icon.png");

const SIDEBAR_W = 164;
const SIDEBAR_H = 314;
const HEADER_W = 150;
const HEADER_H = 57;

/** Dark teal gradient stops (icon-like). */
const TEAL_TOP = { r: 14, g: 72, b: 78 };
const TEAL_BOTTOM = { r: 6, g: 36, b: 42 };
/** Settings chrome background ≈ hsl(210 25% 97%) / #F4F7F9 */
const SLATE_BG = { r: 244, g: 247, b: 249 };
/** Primary ≈ hsl(173 58% 36%) */
const PRIMARY = { r: 38, g: 150, b: 135 };
/** Mint accent for wordmark on dark sidebar */
const MINT = { r: 165, g: 242, b: 208 };

function lerp(a, b, t) {
	return Math.round(a + (b - a) * t);
}

function makeVerticalGradient(width, height, top, bottom) {
	const buf = Buffer.alloc(width * height * 3);
	for (let y = 0; y < height; y++) {
		const t = y / (height - 1);
		const r = lerp(top.r, bottom.r, t);
		const g = lerp(top.g, bottom.g, t);
		const b = lerp(top.b, bottom.b, t);
		for (let x = 0; x < width; x++) {
			const i = (y * width + x) * 3;
			buf[i] = r;
			buf[i + 1] = g;
			buf[i + 2] = b;
		}
	}
	return buf;
}

function makeSolid(width, height, color) {
	const buf = Buffer.alloc(width * height * 3);
	for (let i = 0; i < width * height; i++) {
		const o = i * 3;
		buf[o] = color.r;
		buf[o + 1] = color.g;
		buf[o + 2] = color.b;
	}
	return buf;
}

/** Write Windows 24-bit BMP (bottom-up rows, 4-byte row padding). */
function writeBmp24(filePath, width, height, rgbTopDown) {
	const rowStride = Math.ceil((width * 3) / 4) * 4;
	const pixelSize = rowStride * height;
	const fileSize = 54 + pixelSize;
	const header = Buffer.alloc(54);
	header.write("BM", 0);
	header.writeUInt32LE(fileSize, 2);
	header.writeUInt32LE(0, 6);
	header.writeUInt32LE(54, 10);
	header.writeUInt32LE(40, 14);
	header.writeInt32LE(width, 18);
	header.writeInt32LE(height, 22);
	header.writeUInt16LE(1, 26);
	header.writeUInt16LE(24, 28);
	header.writeUInt32LE(0, 30);
	header.writeUInt32LE(pixelSize, 34);
	header.writeInt32LE(2835, 38);
	header.writeInt32LE(2835, 42);

	const pixels = Buffer.alloc(pixelSize);
	for (let y = 0; y < height; y++) {
		const srcY = height - 1 - y;
		const destRow = y * rowStride;
		for (let x = 0; x < width; x++) {
			const src = (srcY * width + x) * 3;
			const dest = destRow + x * 3;
			// BMP stores BGR
			pixels[dest] = rgbTopDown[src + 2];
			pixels[dest + 1] = rgbTopDown[src + 1];
			pixels[dest + 2] = rgbTopDown[src];
		}
	}

	fs.writeFileSync(filePath, Buffer.concat([header, pixels]));
}

function compositeRgbaOntoRgb(baseRgb, width, height, overlayRgba, ox, oy, ow, oh) {
	for (let y = 0; y < oh; y++) {
		const dy = oy + y;
		if (dy < 0 || dy >= height) continue;
		for (let x = 0; x < ow; x++) {
			const dx = ox + x;
			if (dx < 0 || dx >= width) continue;
			const si = (y * ow + x) * 4;
			const a = overlayRgba[si + 3] / 255;
			if (a === 0) continue;
			const di = (dy * width + dx) * 3;
			baseRgb[di] = Math.round(overlayRgba[si] * a + baseRgb[di] * (1 - a));
			baseRgb[di + 1] = Math.round(overlayRgba[si + 1] * a + baseRgb[di + 1] * (1 - a));
			baseRgb[di + 2] = Math.round(overlayRgba[si + 2] * a + baseRgb[di + 2] * (1 - a));
		}
	}
}

async function renderSvgRgba(svg, width, height) {
	const { data, info } = await sharp(Buffer.from(svg))
		.resize(width, height)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { data, width: info.width, height: info.height };
}

async function buildSidebar() {
	const base = makeVerticalGradient(SIDEBAR_W, SIDEBAR_H, TEAL_TOP, TEAL_BOTTOM);

	const iconSize = 88;
	const iconPng = await sharp(iconPath)
		.resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const iconX = Math.round((SIDEBAR_W - iconSize) / 2);
	const iconY = 72;
	compositeRgbaOntoRgb(base, SIDEBAR_W, SIDEBAR_H, iconPng.data, iconX, iconY, iconSize, iconSize);

	const wordmarkSvg = `
<svg width="${SIDEBAR_W}" height="40" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="28" text-anchor="middle"
    font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600"
    fill="rgb(${MINT.r},${MINT.g},${MINT.b})">BlinkGuard</text>
</svg>`;
	const wordmark = await renderSvgRgba(wordmarkSvg, SIDEBAR_W, 40);
	compositeRgbaOntoRgb(
		base,
		SIDEBAR_W,
		SIDEBAR_H,
		wordmark.data,
		0,
		iconY + iconSize + 12,
		wordmark.width,
		wordmark.height,
	);

	const taglineSvg = `
<svg width="${SIDEBAR_W}" height="36" xmlns="http://www.w3.org/2000/svg">
  <text x="50%" y="14" text-anchor="middle"
    font-family="Segoe UI, Arial, sans-serif" font-size="11"
    fill="rgba(165,242,208,0.72)">Blink healthier</text>
</svg>`;
	const tagline = await renderSvgRgba(taglineSvg, SIDEBAR_W, 36);
	compositeRgbaOntoRgb(
		base,
		SIDEBAR_W,
		SIDEBAR_H,
		tagline.data,
		0,
		iconY + iconSize + 44,
		tagline.width,
		tagline.height,
	);

	return base;
}

async function buildHeader() {
	const base = makeSolid(HEADER_W, HEADER_H, SLATE_BG);

	// Teal accent strip along the bottom
	for (let y = HEADER_H - 3; y < HEADER_H; y++) {
		for (let x = 0; x < HEADER_W; x++) {
			const i = (y * HEADER_W + x) * 3;
			base[i] = PRIMARY.r;
			base[i + 1] = PRIMARY.g;
			base[i + 2] = PRIMARY.b;
		}
	}

	const iconSize = 36;
	const iconPng = await sharp(iconPath)
		.resize(iconSize, iconSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	const iconX = 10;
	const iconY = Math.round((HEADER_H - 3 - iconSize) / 2);
	compositeRgbaOntoRgb(base, HEADER_W, HEADER_H, iconPng.data, iconX, iconY, iconSize, iconSize);

	const titleSvg = `
<svg width="100" height="40" xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="26" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600"
    fill="rgb(34,47,62)">BlinkGuard</text>
</svg>`;
	const title = await renderSvgRgba(titleSvg, 100, 40);
	compositeRgbaOntoRgb(
		base,
		HEADER_W,
		HEADER_H,
		title.data,
		iconX + iconSize + 8,
		Math.round((HEADER_H - 3 - 40) / 2),
		title.width,
		title.height,
	);

	return base;
}

async function main() {
	if (!fs.existsSync(iconPath)) {
		console.error(`Icon not found: ${iconPath}`);
		process.exit(1);
	}
	fs.mkdirSync(outDir, { recursive: true });

	const sidebar = await buildSidebar();
	const header = await buildHeader();

	const sidebarPath = path.join(outDir, "installerSidebar.bmp");
	const uninstallerSidebarPath = path.join(outDir, "uninstallerSidebar.bmp");
	const headerPath = path.join(outDir, "installerHeader.bmp");

	writeBmp24(sidebarPath, SIDEBAR_W, SIDEBAR_H, sidebar);
	fs.copyFileSync(sidebarPath, uninstallerSidebarPath);
	writeBmp24(headerPath, HEADER_W, HEADER_H, header);

	console.log(`Wrote ${path.relative(root, sidebarPath)} (${SIDEBAR_W}×${SIDEBAR_H}, 24-bit)`);
	console.log(`Wrote ${path.relative(root, uninstallerSidebarPath)} (copy)`);
	console.log(`Wrote ${path.relative(root, headerPath)} (${HEADER_W}×${HEADER_H}, 24-bit)`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
