import { useCallback } from "react";
import { type Address } from "viem";
import { medicAuthorityAbi, getPublicClient } from "../config/evm";
import { getDeploymentForRpc } from "../config/network";
import { useChainStore } from "../store/chainStore";

export function useMedicAuthority() {
	const ethRpcUrl = useChainStore((s) => s.ethRpcUrl);
	const addr = getDeploymentForRpc(ethRpcUrl).medicAuthority;

	const isVerifiedMedic = useCallback(
		async (address: `0x${string}`): Promise<boolean | null> => {
			if (!addr) return null; // pre-deployment: graceful no-op
			try {
				const client = getPublicClient(ethRpcUrl);
				const result = await client.readContract({
					address: addr as Address,
					abi: medicAuthorityAbi,
					functionName: "isVerifiedMedic",
					args: [address],
				});
				return result as boolean;
			} catch {
				return null;
			}
		},
		[ethRpcUrl, addr],
	);

	return { isVerifiedMedic, available: addr !== null };
}
