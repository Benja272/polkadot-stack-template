interface StatCardProps {
	label: string;
	value: string;
	accent: string;
}

export function StatCard({ label, value, accent }: StatCardProps) {
	return (
		<div className="card text-center p-4 space-y-1">
			<p className={`text-2xl font-semibold font-display ${accent}`}>{value}</p>
			<p className="text-xs text-text-tertiary uppercase tracking-wider">{label}</p>
		</div>
	);
}

export default StatCard;
