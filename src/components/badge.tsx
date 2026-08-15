import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { theme } from "../../shared/theme";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
	children: ReactNode;
}

export function Badge({ children, className, ...props }: BadgeProps) {
	return (
		<span className={cn(theme.recipe.chip, className)} {...props}>
			{children}
		</span>
	);
}
