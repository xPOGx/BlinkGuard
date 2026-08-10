import { cn } from "@/lib/utils";

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
