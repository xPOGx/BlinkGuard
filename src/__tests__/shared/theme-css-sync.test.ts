import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
	hsl,
	popupCssVars,
	settingsCssVars,
	THEME_CSS_MARKER_END,
	THEME_CSS_MARKER_START,
	theme,
} from "../../../shared/theme";

function markerBodies(source: string): string[] {
	const normalized = source.replace(/\r\n/g, "\n");
	const bodies: string[] = [];
	let from = 0;
	while (true) {
		const start = normalized.indexOf(THEME_CSS_MARKER_START, from);
		if (start < 0) break;
		const end = normalized.indexOf(THEME_CSS_MARKER_END, start);
		if (end < 0) break;
		bodies.push(
			normalized
				.slice(start + THEME_CSS_MARKER_START.length, end)
				.replace(/^\n/, "")
				.replace(/\n[\t ]*$/, ""),
		);
		from = end + THEME_CSS_MARKER_END.length;
	}
	return bodies;
}

function readRepo(relativePath: string): string {
	return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("theme CSS sync", () => {
	it("matches :root and .dark marker blocks in src/index.css", () => {
		const bodies = markerBodies(readRepo("src/index.css"));
		expect(bodies).toHaveLength(2);
		expect(bodies[0]).toBe(settingsCssVars("light"));
		expect(bodies[1]).toBe(settingsCssVars("dark"));
	});

	it("matches :root marker block in public/css/base.css", () => {
		const bodies = markerBodies(readRepo("public/css/base.css"));
		expect(bodies).toHaveLength(1);
		expect(bodies[0]).toBe(popupCssVars());
	});

	it("keeps splash first-paint backgrounds on the same HSL channels", () => {
		const html = readRepo("index.html").replace(/\r\n/g, "\n");
		expect(html).toContain(hsl(theme.color.dark.background));
		expect(html).toContain(hsl(theme.color.light.background));
	});

	it("maps @theme font and 2xs size from theme.ts", () => {
		const css = readRepo("src/index.css").replace(/\r\n/g, "\n");
		expect(css).toContain(`--font-sans: ${theme.font.sans};`);
		expect(css).toContain(`--text-2xs: ${theme.fontSize["2xs"]};`);
	});
});
