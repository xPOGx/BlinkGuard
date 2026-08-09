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

interface SettingRowProps {
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
	children?: ReactNode;
	className?: string;
}

export function SettingRow({
	title,
	description,
	action,
	children,
	className,
}: SettingRowProps) {
	return (
		<div className={cn("min-w-0", className)}>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 space-y-1">
					<div className="flex items-center gap-2 text-sm font-medium text-foreground">
						{title}
					</div>
					{description ? (
						<div className="text-xs text-muted-foreground sm:text-sm">
							{description}
						</div>
					) : null}
				</div>
				{action ? <div className="shrink-0">{action}</div> : null}
			</div>
			{children ? <div className="mt-4">{children}</div> : null}
		</div>
	);
}

interface ToggleSwitchProps {
	checked: boolean;
	onChange: () => void;
	"aria-label": string;
	disabled?: boolean;
	className?: string;
}

export function ToggleSwitch({
	checked,
	onChange,
	"aria-label": ariaLabel,
	disabled = false,
	className,
}: ToggleSwitchProps) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={ariaLabel}
			aria-disabled={disabled || undefined}
			disabled={disabled}
			onClick={() => {
				if (disabled) return;
				onChange();
			}}
			className={cn(
				"relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
				checked ? "bg-primary" : "bg-muted",
				disabled && "cursor-not-allowed opacity-50",
				className,
			)}
		>
			<span
				className={cn(
					"inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
					checked ? "translate-x-6" : "translate-x-1",
				)}
			/>
		</button>
	);
}

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
