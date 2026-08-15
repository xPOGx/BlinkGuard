import type { ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import { cssColor } from "../../shared/theme";

interface RangeSliderProps {
	id?: string;
	min: number;
	max: number;
	value: number;
	step?: number;
	disabled?: boolean;
	onChange: (value: number) => void;
	"aria-label": string;
	className?: string;
}

export function RangeSlider({
	id,
	min,
	max,
	value,
	step = 1,
	disabled = false,
	onChange,
	"aria-label": ariaLabel,
	className,
}: RangeSliderProps) {
	const span = max - min;
	const progress = span <= 0 ? 0 : ((value - min) / span) * 100;
	const fillColor = cssColor("primary");
	const trackColor = cssColor("muted");

	const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
		onChange(Number.parseFloat(event.target.value));
	};

	return (
		<input
			id={id}
			aria-label={ariaLabel}
			type="range"
			min={min}
			max={max}
			step={step}
			value={value}
			disabled={disabled}
			onChange={handleChange}
			className={cn(
				"h-2 w-full cursor-pointer appearance-none rounded-lg bg-muted disabled:cursor-not-allowed",
				className,
			)}
			style={{
				background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${progress}%, ${trackColor} ${progress}%, ${trackColor} 100%)`,
			}}
		/>
	);
}
