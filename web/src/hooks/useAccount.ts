import { sr25519CreateDerive } from "@polkadot-labs/hdkd";
import {
  DEV_PHRASE,
  entropyToMiniSecret,
  mnemonicToEntropy,
} from "@polkadot-labs/hdkd-helpers";
import { getPolkadotSigner } from "polkadot-api/signer";
import { type PolkadotSigner } from "polkadot-api";

// Dev accounts derived from the well-known dev seed phrase
const entropy = mnemonicToEntropy(DEV_PHRASE);
const miniSecret = entropyToMiniSecret(entropy);
const derive = sr25519CreateDerive(miniSecret);

export type DevAccount = {
  name: string;
  signer: PolkadotSigner;
};

function createDevAccount(name: string, path: string): DevAccount {
  const keypair = derive(path);
  return {
    name,
    signer: getPolkadotSigner(keypair.publicKey, "Sr25519", keypair.sign),
  };
}

export const devAccounts: DevAccount[] = [
  createDevAccount("Alice", "//Alice"),
  createDevAccount("Bob", "//Bob"),
  createDevAccount("Charlie", "//Charlie"),
];
