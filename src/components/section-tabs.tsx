import { cn } from "@/lib/utils";

export interface SectionTabItem<T extends string> {
	id: T;
	label: string;
}

interface SectionTabsProps<T extends string> {
	items: readonly SectionTabItem<T>[];
	value: T;
	onChange: (id: T) => void;
	"aria-label": string;
	className?: string;
}

export function SectionTabs<T extends string>({
	items,
	value,
	onChange,
	"aria-label": ariaLabel,
	className,
}: SectionTabsProps<T>) {
	return (
		<div
			role="tablist"
			aria-label={ariaLabel}
			className={cn("flex w-full gap-1", className)}
		>
			{items.map((item) => {
				const selected = item.id === value;
				return (
					<button
						key={item.id}
						type="button"
						role="tab"
						aria-selected={selected}
						onClick={() => onChange(item.id)}
						className={cn(
							"min-w-0 flex-1 rounded-md border border-border px-3 py-1.5 text-center text-sm font-medium transition-colors",
							selected
								? "bg-sidebar-active text-primary shadow-xs"
								: "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
						)}
					>
						<span className="block truncate">{item.label}</span>
					</button>
				);
			})}
		</div>
	);
}
