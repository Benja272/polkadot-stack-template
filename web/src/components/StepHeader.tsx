interface StepHeaderProps {
	number: number;
	title: string;
	active: boolean;
	done: boolean;
}

export function StepHeader({ number, title, active, done }: StepHeaderProps) {
	const badgeClass = done
		? "bg-accent-green/20 text-accent-green"
		: active
			? "bg-polka-500 text-white"
			: "bg-white/10 text-text-muted";

	const titleClass = active || done ? "text-text-primary" : "text-text-muted";

	return (
		<div className="flex items-center gap-3">
			<div
				className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold ${badgeClass}`}
			>
				{done ? (
					<svg
						className="w-4 h-4"
						viewBox="0 0 16 16"
						fill="none"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							d="M3 8l3.5 3.5L13 5"
							stroke="currentColor"
							strokeWidth="1.75"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				) : (
					number
				)}
			</div>
			<span className={`font-semibold ${titleClass}`}>{title}</span>
		</div>
	);
}

export default StepHeader;
