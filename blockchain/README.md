# Blockchain

This directory contains the Rust-side chain implementation and the local-chain artifacts used by the repo scripts.

## Directory Guide

| Path | What it contains |
| --- | --- |
| [`runtime/`](runtime/) | The parachain runtime built on `polkadot-sdk stable2512-3` |
| [`pallets/template/`](pallets/template/) | The Proof of Existence FRAME pallet |
| [`chain_spec.json`](chain_spec.json) | Generated local chain spec used by the dev scripts and some Docker flows |
| [`Dockerfile`](Dockerfile) | Lightweight runtime image that packages a pre-generated chain spec |
| [`zombienet.toml`](zombienet.toml) | Example relay-backed local topology |

## Proof Of Existence Pallet

The pallet in [`pallets/template/`](pallets/template/) implements the core claim flow:

- `create_claim`
- `revoke_claim`

It includes storage, events, errors, weights, benchmarks, a mock runtime, and unit tests.

## Runtime

The runtime in [`runtime/`](runtime/) is a Cumulus-based parachain runtime with:

- Core FRAME pallets such as System, Balances, Aura, Session, Sudo, and XCM
- `TemplatePallet` for Proof of Existence
- `pallet-revive` for both EVM and PVM smart contract execution

For local execution modes, use the repo scripts rather than invoking the node manually:

- [`../scripts/start-dev.sh`](../scripts/start-dev.sh) for the fastest solo-node runtime/pallet loop
- [`../scripts/start-local.sh`](../scripts/start-local.sh) or [`../scripts/start-all.sh`](../scripts/start-all.sh) for the relay-backed topology

On `polkadot-sdk stable2512-3`, the solo-node dev path does not expose Statement Store RPCs. Use the relay-backed scripts when you need Statement Store locally.

## Common Commands

```bash
# Build the runtime
cargo build -p stack-template-runtime --release

# Check the pallet
cargo check -p pallet-template

# Pallet unit tests
cargo test -p pallet-template

# Workspace tests including benchmarks
SKIP_PALLET_REVIVE_FIXTURES=1 cargo test --workspace --features runtime-benchmarks
```

See [`../scripts/README.md`](../scripts/README.md) for the local chain startup flows and [`../docs/INSTALL.md`](../docs/INSTALL.md) for tool installation details.
