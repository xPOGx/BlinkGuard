export type InlineNode =
	| { type: "text"; id: string; text: string }
	| { type: "bold"; id: string; children: InlineNode[] }
	| { type: "link"; id: string; href: string; children: InlineNode[] };

export type BlockNode =
	| { type: "heading"; id: string; level: 2 | 3; children: InlineNode[] }
	| { type: "paragraph"; id: string; children: InlineNode[] }
	| {
			type: "list";
			id: string;
			items: Array<{ id: string; children: InlineNode[] }>;
	  }
	| { type: "blank"; id: string };

/**
 * Minimal markdown for GitHub release bodies: ## / ###, lists, **bold**,
 * [links](url), and bare https:// autolinks.
 */
export function parseSimpleMarkdown(source: string): BlockNode[] {
	const lines = source.replace(/\r\n/g, "\n").split("\n");
	const blocks: BlockNode[] = [];
	let i = 0;
	let nextId = 0;
	const id = () => `n${nextId++}`;

	while (i < lines.length) {
		const line = lines[i] ?? "";
		const trimmed = line.trim();

		if (!trimmed) {
			blocks.push({ type: "blank", id: id() });
			i += 1;
			continue;
		}

		const headingMatch = /^(#{2,3})\s+(.+)$/.exec(trimmed);
		if (headingMatch) {
			const level = (headingMatch[1]?.length === 2 ? 2 : 3) as 2 | 3;
			blocks.push({
				type: "heading",
				id: id(),
				level,
				children: parseInline(headingMatch[2] ?? "", id),
			});
			i += 1;
			continue;
		}

		if (/^[-*]\s+/.test(trimmed)) {
			const items: Array<{ id: string; children: InlineNode[] }> = [];
			while (i < lines.length) {
				const listLine = (lines[i] ?? "").trim();
				if (!/^[-*]\s+/.test(listLine)) break;
				items.push({
					id: id(),
					children: parseInline(listLine.replace(/^[-*]\s+/, ""), id),
				});
				i += 1;
			}
			blocks.push({ type: "list", id: id(), items });
			continue;
		}

		const paragraphLines: string[] = [trimmed];
		i += 1;
		while (i < lines.length) {
			const next = (lines[i] ?? "").trim();
			if (!next || /^(#{2,3})\s+/.test(next) || /^[-*]\s+/.test(next)) {
				break;
			}
			paragraphLines.push(next);
			i += 1;
		}
		blocks.push({
			type: "paragraph",
			id: id(),
			children: parseInline(paragraphLines.join(" "), id),
		});
	}

	return blocks;
}

function parseInline(text: string, id: () => string): InlineNode[] {
	const nodes: InlineNode[] = [];
	const pattern =
		/(\*\*[^*]+\*\*|\[([^\]]+)\]\(([^)]+)\)|(https:\/\/[^\s<]+))/g;
	let lastIndex = 0;
	let match: RegExpExecArray | null = pattern.exec(text);

	while (match) {
		if (match.index > lastIndex) {
			nodes.push({
				type: "text",
				id: id(),
				text: text.slice(lastIndex, match.index),
			});
		}

		const token = match[0];
		if (token.startsWith("**") && token.endsWith("**")) {
			nodes.push({
				type: "bold",
				id: id(),
				children: [{ type: "text", id: id(), text: token.slice(2, -2) }],
			});
		} else if (match[2] !== undefined && match[3] !== undefined) {
			nodes.push({
				type: "link",
				id: id(),
				href: match[3],
				children: [{ type: "text", id: id(), text: match[2] }],
			});
		} else if (match[4] !== undefined) {
			const { href, trailing } = splitTrailingUrlPunctuation(match[4]);
			nodes.push({
				type: "link",
				id: id(),
				href,
				children: [{ type: "text", id: id(), text: href }],
			});
			if (trailing) {
				nodes.push({ type: "text", id: id(), text: trailing });
			}
		}

		lastIndex = match.index + token.length;
		match = pattern.exec(text);
	}

	if (lastIndex < text.length) {
		nodes.push({ type: "text", id: id(), text: text.slice(lastIndex) });
	}

	return nodes.length > 0 ? nodes : [{ type: "text", id: id(), text: "" }];
}

/** Peel closing punctuation that often trails a pasted URL. */
function splitTrailingUrlPunctuation(raw: string): {
	href: string;
	trailing: string;
} {
	let href = raw;
	let trailing = "";
	while (href.length > 0 && /[.,;:!?)]$/.test(href)) {
		// Keep `...` inside GitHub compare URLs.
		if (href.endsWith("...")) break;
		trailing = href.slice(-1) + trailing;
		href = href.slice(0, -1);
	}
	return { href, trailing };
}
