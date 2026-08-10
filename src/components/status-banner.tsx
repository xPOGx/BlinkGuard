import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type StatusBannerVariant = "destructive" | "warning";

interface StatusBannerProps {
	variant?: StatusBannerVariant;
	children: ReactNode;
	className?: string;
	role?: "status" | "alert";
}

const variantClasses: Record<StatusBannerVariant, string> = {
	destructive: "border-destructive/40 bg-destructive/10 text-destructive",
	warning:
		"border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100",
};

export function StatusBanner({
	variant = "warning",
	children,
	className,
	role = "status",
}: StatusBannerProps) {
	return (
		<aside
			role={role}
			className={cn(
				"rounded-lg border p-4",
				variantClasses[variant],
				className,
			)}
		>
			{children}
		</aside>
	);
}
