interface StatPillProps {
	label: string;
	value: string;
}

export function StatPill({ label, value }: StatPillProps) {
	return (
		<div className="flex flex-col items-end gap-0.5">
			<span className="text-xs text-text-tertiary">{label}</span>
			<span className="text-sm font-semibold text-text-primary font-mono">{value}</span>
		</div>
	);
}

export default StatPill;
