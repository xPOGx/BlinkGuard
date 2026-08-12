import { describe, expect, it } from "vitest";
import { parseSimpleMarkdown } from "@/features/about/model/simple-markdown";

describe("parseSimpleMarkdown", () => {
	it("parses headings, lists, bold, and links", () => {
		const blocks = parseSimpleMarkdown(
			[
				"## BlinkGuard 2.1.0",
				"",
				"Goals and **backup** polish.",
				"",
				"### Added",
				"- Goals shop",
				"- [GitHub](https://github.com/xpogx-org/BlinkGuard)",
			].join("\n"),
		);

		expect(blocks).toMatchObject([
			{
				type: "heading",
				level: 2,
				children: [{ type: "text", text: "BlinkGuard 2.1.0" }],
			},
			{ type: "blank" },
			{
				type: "paragraph",
				children: [
					{ type: "text", text: "Goals and " },
					{
						type: "bold",
						children: [{ type: "text", text: "backup" }],
					},
					{ type: "text", text: " polish." },
				],
			},
			{ type: "blank" },
			{
				type: "heading",
				level: 3,
				children: [{ type: "text", text: "Added" }],
			},
			{
				type: "list",
				items: [
					{ children: [{ type: "text", text: "Goals shop" }] },
					{
						children: [
							{
								type: "link",
								href: "https://github.com/xpogx-org/BlinkGuard",
								children: [{ type: "text", text: "GitHub" }],
							},
						],
					},
				],
			},
		]);
		expect(blocks.every((block) => typeof block.id === "string")).toBe(true);
	});

	it("autolinks bare https URLs", () => {
		const blocks = parseSimpleMarkdown(
			"**Full Changelog**: https://github.com/xpogx-org/BlinkGuard/compare/v2.0.0...v2.1.0",
		);
		expect(blocks).toMatchObject([
			{
				type: "paragraph",
				children: [
					{
						type: "bold",
						children: [{ type: "text", text: "Full Changelog" }],
					},
					{ type: "text", text: ": " },
					{
						type: "link",
						href: "https://github.com/xpogx-org/BlinkGuard/compare/v2.0.0...v2.1.0",
						children: [
							{
								type: "text",
								text: "https://github.com/xpogx-org/BlinkGuard/compare/v2.0.0...v2.1.0",
							},
						],
					},
				],
			},
		]);
	});
});
