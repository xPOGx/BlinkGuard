import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingPanelProps {
	children: ReactNode;
	className?: string;
}

export function SettingPanel({ children, className }: SettingPanelProps) {
	return (
		<section
			className={cn(
				"rounded-lg border border-border bg-card p-4 text-card-foreground shadow-xs",
				className,
			)}
		>
			{children}
		</section>
	);
}
