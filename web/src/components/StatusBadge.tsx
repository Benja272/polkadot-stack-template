interface StatusBadgeProps {
	status: string;
}

function getColorClass(status: string): string {
	switch (status) {
		case "Active":
			return "bg-accent-green/10 text-accent-green border border-accent-green/20";
		case "Fulfilled":
		case "Confirmed":
			return "bg-accent-blue/10 text-accent-blue border border-accent-blue/20";
		case "Pending":
			return "bg-accent-yellow/10 text-accent-yellow border border-accent-yellow/20";
		case "Delisted":
		case "Cancelled":
			return "bg-white/5 text-text-muted border border-white/10";
		default:
			return "bg-white/5 text-text-muted border border-white/10";
	}
}

export function StatusBadge({ status }: StatusBadgeProps) {
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getColorClass(status)}`}
		>
			{status}
		</span>
	);
}

export default StatusBadge;
