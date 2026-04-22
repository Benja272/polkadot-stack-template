/**
 * One-shot demo setup: compile contracts, compute multisig, deploy both contracts to
 * Paseo testnet, and write deployments.json + web/src/config/deployments.ts.
 *
 * Usage:
 *   npm run set-deployments                  # compile + deploy to Paseo testnet
 *   npm run set-deployments -- --local       # compile + deploy to local node (http://127.0.0.1:8545)
 *   npm run set-deployments -- --skip-deploy # only recompute multisig, keep existing contract addresses
 *   npm run set-deployments -- --threshold 2 --ss58-prefix 42
 *   npm run set-deployments -- --wallets-dir ../other-keystores
 *
 * Signatories (multisig members) are read from Polkadot.js keystore JSONs
 * (`Council1.json`, `Council2.json`, `Medic.json`) sitting next to the repo root
 * (default: `../` relative to project root). These match the accounts imported
 * into Talisman / Polkadot.js extension and are what pallet-multisig checks at
 * sign time.
 *
 * Deployer (pays gas, no on-chain role) — VITE_ACCOUNT_0_PK from web/.env.local
 * on testnet; Alice's well-known dev key on --local.
 */

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { createWalletClient, createPublicClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
	createKeyMulti,
	encodeAddress,
	cryptoWaitReady,
	sortAddresses,
} from "@polkadot/util-crypto";
import { u8aToHex } from "@polkadot/util";
import { keccak256 } from "viem";
import { updateDeployments } from "./_deployments";

const ENV_FILE = path.resolve(__dirname, "../../../web/.env.local");
const ARTIFACTS_DIR = path.resolve(__dirname, "../artifacts/contracts");
const DEFAULT_WALLETS_DIR = path.resolve(__dirname, "../../../..");
const SIGNATORY_FILES = ["Council1.json", "Council2.json", "Medic.json"];

const TESTNET_RPC = "https://services.polkadothub-rpc.com/testnet";
const LOCAL_RPC = process.env.ETH_RPC_HTTP ?? "http://127.0.0.1:8545";

// Well-known Substrate dev account (Alice). Pre-funded on a fresh local chain.
// Same value as contracts/pvm/hardhat.config.ts and web/src/config/evm.ts.
// On --local we deploy from Alice (who has balance). Council PKs are still used
// to derive the multisig address — but the deployer has no on-chain role in
// either contract (MedicalMarket is ownerless, MedicAuthority's owner is passed
// to the constructor), so deploying from Alice is equivalent.
const ALICE_ETH_KEY = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133";

const paseoTestnet = defineChain({
	id: 420420417,
	name: "Polkadot Hub TestNet",
	nativeCurrency: { name: "Unit", symbol: "UNIT", decimals: 18 },
	rpcUrls: { default: { http: [TESTNET_RPC] } },
});

const localChain = defineChain({
	id: 420420421,
	name: "Polkadot Hub Local",
	nativeCurrency: { name: "Unit", symbol: "UNIT", decimals: 18 },
	rpcUrls: { default: { http: [LOCAL_RPC] } },
});

function parseEnvFile(filePath: string): Record<string, string> {
	if (!fs.existsSync(filePath)) return {};
	const vars: Record<string, string> = {};
	for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq === -1) continue;
		const key = trimmed.slice(0, eq).trim();
		const val = trimmed
			.slice(eq + 1)
			.trim()
			.replace(/^["']|["']$/g, "");
		vars[key] = val;
	}
	return vars;
}

function readSignatoryAddresses(walletsDir: string): string[] {
	return SIGNATORY_FILES.map((name) => {
		const p = path.join(walletsDir, name);
		if (!fs.existsSync(p)) {
			throw new Error(
				`Signatory keystore not found: ${p}. Export the account from Polkadot.js / Talisman as a JSON keystore and drop it here, or pass --wallets-dir to point at the directory.`,
			);
		}
		const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as { address?: string };
		if (!raw.address || typeof raw.address !== "string") {
			throw new Error(`Keystore ${p} is missing an 'address' field.`);
		}
		return raw.address;
	});
}

function argValue(argv: string[], flag: string): string | undefined {
	const i = argv.indexOf(flag);
	return i !== -1 ? argv[i + 1] : undefined;
}

function readArtifact(contractName: string): { abi: unknown[]; bytecode: `0x${string}` } {
	const p = path.join(ARTIFACTS_DIR, `${contractName}.sol`, `${contractName}.json`);
	if (!fs.existsSync(p))
		throw new Error(`Artifact not found: ${p}. Run 'npm run compile' first.`);
	const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as {
		abi: unknown[];
		bytecode: string;
	};
	return { abi: raw.abi, bytecode: raw.bytecode as `0x${string}` };
}

async function deployContract(
	walletClient: ReturnType<typeof createWalletClient>,
	publicClient: ReturnType<typeof createPublicClient>,
	contractName: string,
	args: unknown[] = [],
): Promise<`0x${string}`> {
	const { abi, bytecode } = readArtifact(contractName);
	console.log(`  Deploying ${contractName}...`);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const hash = await (walletClient as any).deployContract({
		abi,
		bytecode,
		args,
		maxPriorityFeePerGas: 10n,
	});
	const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
	if (!receipt.contractAddress) throw new Error(`Deploy tx ${hash} produced no contract address`);
	console.log(`  ${contractName} → ${receipt.contractAddress}`);
	return receipt.contractAddress;
}

async function main() {
	await cryptoWaitReady();

	const argv = process.argv.slice(2);
	const isLocal = argv.includes("--local");
	const skipDeploy = argv.includes("--skip-deploy");
	const threshold = parseInt(argValue(argv, "--threshold") ?? "2", 10);
	const ss58Prefix = parseInt(argValue(argv, "--ss58-prefix") ?? "42", 10);
	const walletsDir = path.resolve(argValue(argv, "--wallets-dir") ?? DEFAULT_WALLETS_DIR);

	const env = parseEnvFile(ENV_FILE);

	// --- Signatories come from keystore JSONs (Polkadot.js / Talisman exports) ---
	// These are the accounts that will actually sign asMulti calls, so they must
	// match what your wallet reports — not a derivation of .env.local private keys.
	const signatories = readSignatoryAddresses(walletsDir);

	if (signatories.length < threshold) {
		console.error(
			`Need at least ${threshold} keystore files in ${walletsDir} (${SIGNATORY_FILES.join(", ")}). Found ${signatories.length}.`,
		);
		process.exit(1);
	}

	const sorted = sortAddresses(signatories, ss58Prefix);
	const multiAccountId = createKeyMulti(sorted, threshold);
	const multiSs58 = encodeAddress(multiAccountId, ss58Prefix);
	const multisigH160 = ("0x" +
		keccak256(u8aToHex(multiAccountId) as `0x${string}`).slice(2 + 24)) as `0x${string}`;

	console.log("=== Multisig ===");
	console.log(`  SS58:      ${multiSs58}`);
	console.log(`  H160:      ${multisigH160}`);
	console.log(`  Threshold: ${threshold}-of-${sorted.length}`);
	for (const s of sorted) console.log(`    - ${s}`);
	console.log("");

	const network = isLocal ? "local" : "paseo";

	if (skipDeploy) {
		updateDeployments(network, {
			multisig: { ss58: multiSs58, h160: multisigH160, threshold, signatories: sorted },
		});
		console.log(
			`--skip-deploy: multisig updated for ${network}, contract addresses unchanged.`,
		);
		return;
	}

	// --- Compile contracts ---
	console.log("=== Compiling contracts ===");
	execSync("npx hardhat compile", { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
	console.log("");

	// --- Deploy ---
	const networkLabel = isLocal ? "local" : "Paseo testnet";
	const rpc = isLocal ? LOCAL_RPC : TESTNET_RPC;
	const chain = isLocal ? localChain : paseoTestnet;
	// Local: Alice (pre-funded dev account). Paseo: VITE_ACCOUNT_0_PK (user-funded via faucet).
	// Deployer identity has no on-chain role (MedicalMarket is ownerless, MedicAuthority owner
	// is passed to the constructor) — it only pays gas.
	const envPk = env.VITE_ACCOUNT_0_PK;
	if (!isLocal && (!envPk || envPk === "0x" || envPk.length <= 2)) {
		console.error(
			"VITE_ACCOUNT_0_PK is required in web/.env.local to deploy to Paseo. Fund its H160 at https://faucet.polkadot.io.",
		);
		process.exit(1);
	}
	const deployerPk = (isLocal ? ALICE_ETH_KEY : envPk) as `0x${string}`;

	console.log(`=== Deploying to ${networkLabel} (${rpc}) ===`);
	console.log(`  Deployer: ${privateKeyToAccount(deployerPk).address}`);
	console.log("");

	const account = privateKeyToAccount(deployerPk);
	const walletClient = createWalletClient({ account, chain, transport: http(rpc) });
	const publicClient = createPublicClient({ chain, transport: http(rpc) });

	const marketAddress = await deployContract(walletClient, publicClient, "MedicalMarket");
	const authorityAddress = await deployContract(walletClient, publicClient, "MedicAuthority", [
		multisigH160,
	]);

	console.log("");

	// --- Write all deployment files ---
	updateDeployments(network, {
		medicalMarket: marketAddress,
		medicAuthority: authorityAddress,
		multisig: { ss58: multiSs58, h160: multisigH160, threshold, signatories: sorted },
	});

	console.log("=== Done ===");
	console.log(`  MedicalMarket:  ${marketAddress}`);
	console.log(`  MedicAuthority: ${authorityAddress}`);
	console.log(`  Multisig SS58:  ${multiSs58}`);
	console.log(`  Multisig H160:  ${multisigH160}`);
	console.log("");
	console.log("  deployments.json and web/src/config/deployments.ts updated.");
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
