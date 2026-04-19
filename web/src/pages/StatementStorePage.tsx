import { useState, useEffect } from "react";
import { useChainStore } from "../store/chainStore";
import { subscribeStatements } from "../hooks/useStatementStore";

export default function StatementStorePage() {
	const wsUrl = useChainStore((s) => s.wsUrl);
	const [cache, setCache] = useState<Map<string, Uint8Array>>(new Map());

	useEffect(() => {
		const { unsubscribe } = subscribeStatements(wsUrl, setCache);
		return unsubscribe;
	}, [wsUrl]);

	function tryDecodeUtf8(data: Uint8Array): string | null {
		try {
			const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
			if (/^[\x20-\x7e\t\n\r]+$/.test(text)) return text;
		} catch {
			// not valid utf-8
		}
		return null;
	}

	function detectFileType(data: Uint8Array): { ext: string; mime: string } {
		if (data.length >= 4) {
			// PNG: 89 50 4E 47
			if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47)
				return { ext: "png", mime: "image/png" };
			// GIF: 47 49 46 38
			if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38)
				return { ext: "gif", mime: "image/gif" };
			// PDF: 25 50 44 46
			if (data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46)
				return { ext: "pdf", mime: "application/pdf" };
			// ZIP: 50 4B 03 04
			if (data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04)
				return { ext: "zip", mime: "application/zip" };
			// WASM: 00 61 73 6D
			if (data[0] === 0x00 && data[1] === 0x61 && data[2] === 0x73 && data[3] === 0x6d)
				return { ext: "wasm", mime: "application/wasm" };
		}
		if (data.length >= 3) {
			// JPEG: FF D8 FF
			if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff)
				return { ext: "jpg", mime: "image/jpeg" };
		}
		// WebP: RIFF....WEBP
		if (
			data.length >= 12 &&
			data[0] === 0x52 &&
			data[1] === 0x49 &&
			data[2] === 0x46 &&
			data[3] === 0x46 &&
			data[8] === 0x57 &&
			data[9] === 0x45 &&
			data[10] === 0x42 &&
			data[11] === 0x50
		)
			return { ext: "webp", mime: "image/webp" };

		// Text-based detection
		const text = tryDecodeUtf8(data);
		if (text !== null) {
			const trimmed = text.trimStart();
			if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
				try {
					JSON.parse(trimmed);
					return { ext: "json", mime: "application/json" };
				} catch {
					/* not valid JSON */
				}
			}
			return { ext: "txt", mime: "text/plain" };
		}

		return { ext: "bin", mime: "application/octet-stream" };
	}

	function downloadData(data: Uint8Array, hash: string) {
		const { ext, mime } = detectFileType(data);
		const blob = new Blob([data], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `statement-${hash.slice(2, 10)}.${ext}`;
		a.click();
		URL.revokeObjectURL(url);
	}

	const entries = Array.from(cache.entries());

	return (
		<div className="space-y-6 animate-fade-in">
			<div className="space-y-2">
				<h1 className="page-title text-accent-orange">Statement Store</h1>
				<p className="text-text-secondary">
					View statements stored in the statement store. Inside the Polkadot Host,
					statements arrive via live subscription. In local dev, a one-shot dump is
					performed.
				</p>
			</div>

			<div className="card space-y-4">
				<h2 className="section-title">
					Statements{" "}
					<span className="text-text-muted text-sm font-normal">({entries.length})</span>
				</h2>

				{entries.length === 0 && (
					<p className="text-text-muted text-sm">
						No statements in the store yet. Create a listing on the Patient Dashboard to
						populate the store.
					</p>
				)}

				<div className="space-y-2">
					{entries.map(([hash, data]) => {
						const textPreview = tryDecodeUtf8(data);
						return (
							<div
								key={hash}
								className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-sm space-y-1.5"
							>
								<p className="font-mono text-xs text-text-secondary break-all">
									{hash}
								</p>
								<p className="text-text-tertiary">
									Data:{" "}
									<span className="text-text-secondary">
										{data.length.toLocaleString()} bytes
									</span>
								</p>
								{textPreview && (
									<pre className="text-xs text-text-muted rounded-md border border-white/[0.04] bg-white/[0.02] px-2 py-1.5 mt-1.5 overflow-x-auto max-h-24 font-mono">
										{textPreview.length > 500
											? textPreview.slice(0, 500) + "..."
											: textPreview}
									</pre>
								)}
								<button
									onClick={() => downloadData(data, hash)}
									className="mt-1 btn-secondary text-xs py-1"
								>
									Download
								</button>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
