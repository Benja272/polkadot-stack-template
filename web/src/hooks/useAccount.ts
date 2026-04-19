import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import {
	DEV_PHRASE,
	entropyToMiniSecret,
	mnemonicToEntropy,
	ss58Address,
} from "@polkadot-labs/hdkd-helpers";
import { getPolkadotSigner } from "polkadot-api/signer";
import { type PolkadotSigner } from "polkadot-api";
import { connectInjectedExtension, getInjectedExtensions } from "polkadot-api/pjs-signer";
import {
	createAccountsProvider,
	injectSpektrExtension,
	sandboxTransport,
	SpektrExtensionName,
	type ProductAccount,
} from "@novasamatech/product-sdk";
import { Keccak256 } from "@polkadot-api/substrate-bindings";
import { MARKETPLACE_ACCOUNT_ID } from "./useStatementStore";

// Dev accounts derived from the well-known dev seed phrase
const entropy = mnemonicToEntropy(DEV_PHRASE);
const miniSecret = entropyToMiniSecret(entropy);
const derive = sr25519CreateDerive(miniSecret);

/**
 * Derive the EVM H160 address from a 32-byte Substrate public key.
 *
 * Matches pallet-revive's AccountMapper behaviour:
 *   - If the AccountId32 is already ETH-derived (last 12 bytes are 0xee),
 *     the H160 is the first 20 bytes.
 *   - Otherwise (e.g. sr25519 public key), H160 = keccak256(publicKey)[12..32]
 *     (same derivation pallet-revive uses when calling map_account on an
 *     sr25519 account — msg.sender inside the contract matches this).
 */
export function substrateToH160(publicKey: Uint8Array): `0x${string}` {
	const isEthDerived = publicKey.length === 32 && publicKey.slice(20).every((b) => b === 0xee);
	const h160Bytes = isEthDerived ? publicKey.slice(0, 20) : Keccak256(publicKey).slice(-20);
	return `0x${Array.from(h160Bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("")}` as `0x${string}`;
}

export type LocalSigner = {
	publicKey: Uint8Array;
	signBytes: (data: Uint8Array) => Promise<Uint8Array>;
};

export type AppAccount = {
	name: string;
	/** SS58-encoded Substrate address */
	address: string;
	signer: PolkadotSigner;
	/** H160 address as seen by pallet-revive contracts (DefaultAddressMapper) */
	evmAddress: `0x${string}`;
	/**
	 * Optional override for statement store signing.
	 * Used when the main signer (e.g. Nova Wallet) wraps raw bytes with <Bytes>
	 * prefix, which the substrate statement store doesn't expect.
	 */
	localSigner?: LocalSigner;
};

/** @deprecated Use AppAccount */
export type DevAccount = AppAccount;

function createDevAccount(name: string, path: string): AppAccount {
	const keypair = derive(path);
	return {
		name,
		address: ss58Address(keypair.publicKey),
		signer: getPolkadotSigner(keypair.publicKey, "Sr25519", keypair.sign),
		evmAddress: substrateToH160(keypair.publicKey),
		localSigner: {
			publicKey: keypair.publicKey,
			signBytes: (data: Uint8Array) => Promise.resolve(keypair.sign(data)),
		},
	};
}

export const devAccounts: AppAccount[] = [
	createDevAccount("Alice", "//Alice"),
	createDevAccount("Bob", "//Bob"),
	createDevAccount("Charlie", "//Charlie"),
];

// Lazy singleton — one accountsProvider per app session.
// Matches the pattern in useStatementStore.ts (`_store`).
let _accountsProvider: ReturnType<typeof createAccountsProvider> | null = null;
const getAccountsProvider = () => (_accountsProvider ??= createAccountsProvider(sandboxTransport));

/**
 * Resolve accounts via:
 *   1. Polkadot Host product account (`getProductAccount(dotNsId, 0)`) — stable
 *      per-app identity across sessions/devices (same wallet, same dotNsId → same
 *      public key). Replaces the per-session "guest" account path that previously
 *      returned a fresh keypair every session, orphaning any listing created with
 *      the previous guest.
 *   2. Browser extension wallets (Polkadot.js, Talisman, SubWallet)
 *   3. Dev accounts (local only)
 *
 * The QR-paired host-papp path was previously slotted between 1 and 2 but is
 * currently disabled — QR pairing is handled by the Polkadot Host shell when
 * the app is served from `<domain>.dot.li`. See web/src/hooks/usePairing.ts
 * (kept for reference, not wired in).
 */
export async function getAccountsWithFallback(): Promise<AppAccount[]> {
	// 1. Polkadot Host product account (stable per dotNsId)
	// When we're inside the Host, we MUST use the product account — falling through
	// to browser extensions / dev accounts gives us the wrong msg.sender at
	// contract-call time and makes listings created here unfullfillable on
	// re-open (different keypair → different H160).
	let hostReady = false;
	try {
		hostReady = await injectSpektrExtension();
		console.log("[account] Host ready:", hostReady);
		if (hostReady) {
			const [dotNsIdentifier, derivationIndex] = MARKETPLACE_ACCOUNT_ID;
			const provider = getAccountsProvider();
			console.log("[account] requesting product account", {
				dotNsIdentifier,
				derivationIndex,
			});
			const result = await Promise.race([
				provider.getProductAccount(dotNsIdentifier, derivationIndex),
				new Promise<never>((_, r) =>
					setTimeout(() => r(new Error("getProductAccount timed out (10s)")), 10_000),
				),
			]);
			console.log("[account] getProductAccount result isOk?", result.isOk());
			if (result.isOk()) {
				const { publicKey, name } = result.value;
				const productAccount: ProductAccount = {
					dotNsIdentifier,
					derivationIndex,
					publicKey,
				};
				const acc = {
					name: name ?? "Polkadot Host",
					address: ss58Address(publicKey),
					signer: provider.getProductAccountSigner(productAccount),
					evmAddress: substrateToH160(publicKey),
				};
				console.log("[account] product account resolved:", {
					name: acc.name,
					address: acc.address,
					evmAddress: acc.evmAddress,
				});
				return [acc];
			} else {
				console.warn("[account] getProductAccount returned Err:", result.error);
			}
		}
	} catch (err) {
		console.warn("[account] Product account path threw:", err);
	}

	// Inside Host with no product account → refuse to fall through. Returning
	// dev accounts here would silently use Alice/Bob/Charlie for signing, which
	// the Host proxies AS IF it were the user — landing txs with the wrong H160.
	if (hostReady) {
		console.error(
			"[account] Host is ready but product account failed; refusing to fall back to dev/extension accounts. The UI will show no account — reload the page to retry.",
		);
		return [];
	}

	// 2. Browser extension wallets
	try {
		const extensions = getInjectedExtensions().filter((n) => n !== SpektrExtensionName);
		if (extensions.length > 0) {
			const ext = await connectInjectedExtension(extensions[0]);
			const accounts = ext.getAccounts();
			if (accounts.length > 0) {
				return accounts.map((acc) => ({
					name: acc.name ?? `${acc.address.slice(0, 6)}…${acc.address.slice(-4)}`,
					address: acc.address,
					signer: acc.polkadotSigner,
					evmAddress: substrateToH160(acc.polkadotSigner.publicKey),
				}));
			}
		}
	} catch {
		// No extension found — fall through
	}

	// 3. Dev accounts
	return devAccounts;
}

const devPaths = ["//Alice", "//Bob", "//Charlie"];

/**
 * Get the raw sr25519 keypair for a dev account by index.
 * @deprecated Prefer using AppAccount.signer for signing.
 */
export function getDevKeypair(index: number): {
	publicKey: Uint8Array;
	sign: (message: Uint8Array) => Uint8Array;
} {
	const keypair = derive(devPaths[index]);
	return { publicKey: keypair.publicKey, sign: keypair.sign };
}
