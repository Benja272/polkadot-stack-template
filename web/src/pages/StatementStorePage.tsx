import { useState, useEffect } from "react";
import { useChainStore } from "../store/chainStore";
import {
	checkStatementStoreAvailable,
	fetchStatements,
	type DecodedStatement,
} from "../hooks/useStatementStore";

export default function StatementStorePage() {
	const wsUrl = useChainStore((s) => s.wsUrl);
	const [available, setAvailable] = useState<boolean | null>(null);
	const [statements, setStatements] = useState<DecodedStatement[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		checkStatementStoreAvailable(wsUrl).then((ok) => {
			setAvailable(ok);
			if (ok) loadStatements();
		});
	}, [wsUrl]); // eslint-disable-line react-hooks/exhaustive-deps

	async function loadStatements() {
		try {
			setLoading(true);
			setError(null);
			const result = await fetchStatements(wsUrl);
			setStatements(result);
		} catch (e) {
			console.error("Failed to fetch statements:", e);
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setLoading(false);
		}
	}

	function tryDecodeUtf8(data: Uint8Array | null): string | null {
		if (!data) return null;
		try {
			const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
			if (/^[\x20-\x7e\t\n\r]+$/.test(text)) return text;
		} catch {
			// not valid utf-8
		}
		return null;
	}

	if (available === null) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-bold text-orange-400">Statement Store</h1>
				<p className="text-gray-500 text-sm">Checking availability...</p>
			</div>
		);
	}

	if (!available) {
		return (
			<div className="space-y-6">
				<h1 className="text-2xl font-bold text-orange-400">Statement Store</h1>
				<p className="text-gray-400">
					View statements stored in the node's local Statement Store.
				</p>
				<div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
					<p className="text-gray-500 text-sm">
						The connected node does not expose Statement Store RPCs. In
						polkadot-sdk stable2512-3, the statement store is only available in
						non-dev mode (requires a relay chain via Zombienet). See{" "}
						<code className="text-gray-400">statement-store.md</code> for details.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-bold text-orange-400">Statement Store</h1>
			<p className="text-gray-400">
				View statements stored in the node's local Statement Store. Statements are
				off-chain data propagated across the peer-to-peer network.
			</p>

			<div className="bg-gray-900 rounded-lg p-5 border border-gray-800 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-semibold text-gray-300">
						Statements{" "}
						<span className="text-gray-500 text-sm font-normal">
							({statements.length})
						</span>
					</h2>
					<button
						onClick={loadStatements}
						disabled={loading}
						className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
					>
						{loading ? "Loading..." : "Refresh"}
					</button>
				</div>

				{error && <p className="text-red-400 text-sm">{error}</p>}

				{statements.length === 0 && !loading && !error && (
					<p className="text-gray-500 text-sm">No statements in the store.</p>
				)}

				<div className="space-y-2">
					{statements.map((stmt, i) => {
						const textPreview = tryDecodeUtf8(stmt.data);
						return (
							<div
								key={i}
								className="bg-gray-800 rounded p-3 text-sm space-y-1"
							>
								<p className="font-mono text-xs text-gray-300 break-all">
									{stmt.hash}
								</p>
								<p className="text-gray-400">
									{stmt.proofType && (
										<>
											Proof:{" "}
											<span className="text-gray-300">
												{stmt.proofType}
											</span>{" "}
											|{" "}
										</>
									)}
									{stmt.signer && (
										<>
											Signer:{" "}
											<span className="text-gray-300 font-mono text-xs">
												{stmt.signer.slice(0, 10)}...
												{stmt.signer.slice(-6)}
											</span>{" "}
											|{" "}
										</>
									)}
									Data:{" "}
									<span className="text-gray-300">
										{stmt.dataLength.toLocaleString()} bytes
									</span>
									{stmt.topics.length > 0 && (
										<>
											{" "}
											| Topics:{" "}
											<span className="text-gray-300">
												{stmt.topics.length}
											</span>
										</>
									)}
									{stmt.priority !== null && (
										<>
											{" "}
											| Priority:{" "}
											<span className="text-gray-300">
												{stmt.priority}
											</span>
										</>
									)}
								</p>
								{textPreview && (
									<pre className="text-xs text-gray-500 bg-gray-900 rounded px-2 py-1 mt-1 overflow-x-auto max-h-24">
										{textPreview.length > 500
											? textPreview.slice(0, 500) + "..."
											: textPreview}
									</pre>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
