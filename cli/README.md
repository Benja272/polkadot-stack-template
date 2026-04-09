# CLI

This directory contains `stack-cli`, the Rust command-line tool for interacting with the template chain through:

- [subxt](https://github.com/parity-tech/subxt) for Substrate RPC
- [alloy](https://alloy.rs) for Ethereum-compatible contract calls

## Run It

From the repo root:

```bash
cargo run -p stack-cli -- --help
```

## Command Groups

- `pallet`: `create-claim`, `revoke-claim`, `get-claim`, `list-claims`
- `contract`: `create-claim <evm|pvm>`, `revoke-claim`, `get-claim`, `info`
- `chain`: `info`, `blocks`, `statement-submit`, `statement-dump`

## Examples

From the repo root:

```bash
# Chain info
cargo run -p stack-cli -- chain info

# Pallet interaction
cargo run -p stack-cli -- pallet create-claim --file ./README.md
cargo run -p stack-cli -- pallet list-claims

# Statement Store
cargo run -p stack-cli -- chain statement-submit --file ./README.md --signer alice
cargo run -p stack-cli -- chain statement-dump

# Contract interaction
cargo run -p stack-cli -- contract create-claim evm --file ./README.md
cargo run -p stack-cli -- contract info
```

## Signers

- Pallet commands accept dev names, mnemonic phrases, or `0x` secret seeds.
- Contract commands accept dev names or `0x` Ethereum private keys.

## Contract Address Loading

After contract deployment, the CLI reads addresses from the repo-root `deployments.json`. The contract deploy scripts keep that file in sync with [`../web/src/config/deployments.ts`](../web/src/config/deployments.ts).

## Bulletin Chain Uploads

Passing `--upload` uploads file bytes through `TransactionStorage.store()` before claiming the hash.

When using a raw Ethereum private key for contract commands, also pass `--bulletin-signer` for the Substrate-side Bulletin upload signer.

See [`../contracts/README.md`](../contracts/README.md) for deployment flow details and [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for broader CLI examples.
