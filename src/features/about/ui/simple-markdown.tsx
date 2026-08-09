import type { ReactNode } from "react";
import {
	type BlockNode,
	type InlineNode,
	parseSimpleMarkdown,
} from "@/features/about/model/simple-markdown";
import { rendererIpc } from "@/shared/ipc/renderer-ipc";
import { isAllowedExternalUrl } from "../../../../shared/release-notes";

type SimpleMarkdownProps = {
	source: string;
	className?: string;
};

export function SimpleMarkdown({ source, className }: SimpleMarkdownProps) {
	const blocks = parseSimpleMarkdown(source);
	return (
		<div className={className}>
			{blocks.map((block) => (
				<BlockView key={block.id} block={block} />
			))}
		</div>
	);
}

function BlockView({ block }: { block: BlockNode }) {
	switch (block.type) {
		case "blank":
			return <div className="h-2" aria-hidden />;
		case "heading": {
			const Tag = block.level === 2 ? "h3" : "h4";
			return (
				<Tag
					className={
						block.level === 2
							? "mt-3 text-sm font-semibold text-foreground first:mt-0"
							: "mt-2 text-sm font-medium text-foreground first:mt-0"
					}
				>
					<InlineView nodes={block.children} />
				</Tag>
			);
		}
		case "paragraph":
			return (
				<p className="mt-1 text-sm text-muted-foreground first:mt-0">
					<InlineView nodes={block.children} />
				</p>
			);
		case "list":
			return (
				<ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground first:mt-0">
					{block.items.map((item) => (
						<li key={item.id}>
							<InlineView nodes={item.children} />
						</li>
					))}
				</ul>
			);
		default:
			return null;
	}
}

function InlineView({ nodes }: { nodes: InlineNode[] }): ReactNode {
	return nodes.map((node) => {
		switch (node.type) {
			case "text":
				return <span key={node.id}>{node.text}</span>;
			case "bold":
				return (
					<strong key={node.id} className="font-semibold text-foreground">
						<InlineView nodes={node.children} />
					</strong>
				);
			case "link": {
				const href = node.href;
				const safe = isAllowedExternalUrl(href);
				if (!safe) {
					return (
						<span key={node.id}>
							<InlineView nodes={node.children} />
						</span>
					);
				}
				return (
					<button
						key={node.id}
						type="button"
						className="inline cursor-pointer text-left text-primary underline underline-offset-2"
						onClick={() => rendererIpc.openExternalUrl(href)}
					>
						<InlineView nodes={node.children} />
					</button>
				);
			}
			default:
				return null;
		}
	});
}
