import { CopyButton } from "./CopyButton";

interface OutputFieldProps {
	label: string;
	value: string;
}

export function OutputField({ label, value }: OutputFieldProps) {
	return (
		<div>
			<label className="label">{label}</label>
			<div className="input-field flex items-center gap-2">
				<span className="flex-1 truncate font-mono text-xs text-text-secondary min-w-0">
					{value}
				</span>
				<CopyButton value={value} />
			</div>
		</div>
	);
}

export default OutputField;
