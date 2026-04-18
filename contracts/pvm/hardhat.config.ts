import type { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-viem";
import "@parity/hardhat-polkadot";
import { vars } from "hardhat/config";
import { defineChain } from "viem";

export const polkadotHubTestnet = defineChain({
	id: 420420417,
	name: "Polkadot Hub TestNet",
	nativeCurrency: { name: "Unit", symbol: "UNIT", decimals: 18 },
	rpcUrls: {
		default: { http: ["https://services.polkadothub-rpc.com/testnet"] },
	},
});

const config: HardhatUserConfig = {
	solidity: {
		version: "0.8.28",
		settings: {
			// Required for the Verifier contract: pure-Solidity BN254 verifier hits
			// the 16-variable stack limit without IR-based codegen.
			viaIR: true,
			optimizer: { enabled: true, runs: 200 },
		},
	},
	resolc: {
		version: "1.0.0",
	},
	networks: {
		local: {
			// Local node Ethereum RPC endpoint (via eth-rpc adapter)
			url: process.env.ETH_RPC_HTTP || "http://127.0.0.1:8545",
			accounts: [
				// Alice dev account private key
				"0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133",
			],
		},
		polkadotTestnet: {
			url: "https://services.polkadothub-rpc.com/testnet",
			chainId: 420420417,
			accounts: [process.env.PRIVATE_KEY ?? vars.get("PRIVATE_KEY", "")].filter(Boolean),
		},
	},
};

export default config;
