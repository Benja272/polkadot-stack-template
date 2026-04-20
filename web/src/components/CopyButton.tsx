import { useState } from "react";

type CopyState = "idle" | "copied" | "failed";

interface CopyButtonProps {
	value: string;
	className?: string;
}

export function CopyButton({ value, className = "" }: CopyButtonProps) {
	const [state, setState] = useState<CopyState>("idle");

	async function handleClick() {
		try {
			await navigator.clipboard.writeText(value);
			setState("copied");
			setTimeout(() => setState("idle"), 2000);
		} catch {
			setState("failed");
			setTimeout(() => setState("idle"), 1000);
		}
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			className={`text-text-tertiary hover:text-polka-400 transition-colors flex-shrink-0 ${className}`}
			aria-label="Copy to clipboard"
		>
			{state === "idle" && (
				<svg
					className="w-5 h-5"
					viewBox="0 0 20 20"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<rect
						x="7"
						y="7"
						width="9"
						height="9"
						rx="1.5"
						stroke="currentColor"
						strokeWidth="1.5"
					/>
					<path
						d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-7A1.5 1.5 0 0 0 3 5.5v7A1.5 1.5 0 0 0 4.5 14H7"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
					/>
				</svg>
			)}
			{state === "copied" && (
				<svg
					className="w-5 h-5 text-accent-green"
					viewBox="0 0 20 20"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M4 10l4.5 4.5L16 6"
						stroke="currentColor"
						strokeWidth="1.75"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			)}
			{state === "failed" && (
				<svg
					className="w-5 h-5 text-accent-red"
					viewBox="0 0 20 20"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						d="M5 5l10 10M15 5L5 15"
						stroke="currentColor"
						strokeWidth="1.75"
						strokeLinecap="round"
					/>
				</svg>
			)}
		</button>
	);
}

export default CopyButton;
