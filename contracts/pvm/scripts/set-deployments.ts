/**
 * One-shot demo setup: compile contracts, compute multisig, deploy both contracts to
 * Paseo testnet, and write deployments.json + web/src/config/deployments.ts.
 *
 * Usage:
 *   npm run set-deployments                  # compile + deploy to Paseo testnet
 *   npm run set-deployments -- --local       # compile + deploy to local node (http://127.0.0.1:8545)
 *   npm run set-deployments -- --skip-deploy # only recompute multisig, keep existing contract addresses
 *   npm run set-deployments -- --threshold 2 --ss58-prefix 42
 *
 * Reads VITE_ACCOUNT_0_PK (deployer), VITE_ACCOUNT_0_PK / _1_PK / _2_PK (council multisig)
 * from web/.env.local.
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

const TESTNET_RPC = "https://services.polkadothub-rpc.com/testnet";
const LOCAL_RPC = process.env.ETH_RPC_HTTP ?? "http://127.0.0.1:8545";

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

function h160ToAccountId32(h160: string): Uint8Array {
	const clean = h160.startsWith("0x") ? h160.slice(2) : h160;
	const bytes = new Uint8Array(32);
	for (let i = 0; i < 20; i++) {
		bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
	}
	bytes.fill(0xee, 20);
	return bytes;
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

	const env = parseEnvFile(ENV_FILE);

	// --- Derive council signatories and multisig address ---
	const pks = [env.VITE_ACCOUNT_0_PK, env.VITE_ACCOUNT_1_PK, env.VITE_ACCOUNT_2_PK].filter(
		(pk): pk is string => !!pk && pk !== "0x" && pk.length > 2,
	);

	if (pks.length < threshold) {
		console.error(
			`Need at least ${threshold} private keys in web/.env.local (VITE_ACCOUNT_{0,1,2}_PK). Found ${pks.length}.`,
		);
		process.exit(1);
	}

	const signatories = pks.map((pk) => {
		const h160 = privateKeyToAccount(pk as `0x${string}`).address;
		const accountId = h160ToAccountId32(h160);
		return encodeAddress(accountId, ss58Prefix);
	});

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

	if (skipDeploy) {
		updateDeployments({
			multisig: { ss58: multiSs58, h160: multisigH160, threshold, signatories: sorted },
		});
		console.log("--skip-deploy: multisig updated, contract addresses unchanged.");
		return;
	}

	// --- Compile contracts ---
	console.log("=== Compiling contracts ===");
	execSync("npx hardhat compile", { stdio: "inherit", cwd: path.resolve(__dirname, "..") });
	console.log("");

	// --- Deploy ---
	const network = isLocal ? "local" : "Paseo testnet";
	const rpc = isLocal ? LOCAL_RPC : TESTNET_RPC;
	const chain = isLocal ? localChain : paseoTestnet;
	const deployerPk = pks[0] as `0x${string}`;

	console.log(`=== Deploying to ${network} (${rpc}) ===`);
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
	updateDeployments({
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
