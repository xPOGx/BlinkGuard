import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingGridProps {
	children: ReactNode;
	className?: string;
}

export function SettingGrid({ children, className }: SettingGridProps) {
	return (
		<div
			className={cn(
				"grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4",
				className,
			)}
		>
			{children}
		</div>
	);
}
