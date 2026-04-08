# Scripts

This directory contains convenience scripts for the main local development, testing, and deployment flows in this repo.

All scripts resolve the repo root automatically, so you can run them from the repo root with:

```bash
./scripts/<script-name>.sh
```

## Script Guide

| Script | What it does | When to use it |
| --- | --- | --- |
| `start-dev.sh` | Builds the runtime, generates `blockchain/chain_spec.json`, and starts a single local omni-node on `ws://127.0.0.1:9944`. | Use this when you only need the local parachain RPC and runtime, without Ethereum RPC, contract deployment, or the frontend. |
| `start-dev-with-contracts.sh` | Builds the runtime, generates the local chain spec, compiles both contract projects, starts a single local omni-node plus `eth-rpc`, waits for the local chain and Ethereum RPC readiness, and deploys the EVM and PVM Proof of Existence contracts to the local chain. | Use this when you want a local chain that is ready for contract testing from the CLI or frontend, but you do not need the frontend started for you. |
| `start-frontend.sh` | Installs frontend dependencies, refreshes PAPI descriptors if a local node is running on `ws://127.0.0.1:9944`, and starts the Vite dev server. | Use this when the chain is already running and you only want to work on the web app. |
| `start-all.sh` | Runs the full local stack: runtime build, local chain-spec generation, contract compilation, single-node startup, `eth-rpc`, local contract deployment, and frontend startup. | Use this when you want the fastest one-command setup for full-stack local development. |
| `start-local.sh` | Starts the Zombienet-based local network defined by `blockchain/zombienet.toml` using the fixed local ports expected by the repo tooling. | Use this when you want to inspect or work with the relay-chain + parachain network directly, without the contract/frontend setup steps. |
| `deploy-paseo.sh` | Installs dependencies, compiles, and deploys the EVM and PVM contracts to the Polkadot testnet configuration used by the Hardhat projects. | Use this when you are deploying contract examples to testnet rather than running them locally. Make sure the required `PRIVATE_KEY` values are configured first. |
| `deploy-frontend.sh` | Builds the frontend and uploads `web/dist` to IPFS using the `w3` CLI, then prints the CID and suggested DotNS follow-up steps. | Use this when you want to publish the frontend as a static deployment. |
| `start-zombienet-all.sh` | Runs the full stack using Zombienet instead of a single dev node: runtime build, chain-spec generation, contract compilation, Zombienet startup (relay chain + parachain), `eth-rpc`, local contract deployment, CLI build, and frontend startup. | Use this when you need the full local environment with **all features working**, including Statement Store RPCs (which are unavailable in dev mode due to a polkadot-sdk bug). |
| `test-zombienet.sh` | Starts a Zombienet network, deploys EVM and PVM contracts, and runs automated E2E tests covering pallet PoE, EVM contract PoE, PVM contract PoE, Statement Store submit/dump, combined pallet+statement-store claims, and the `prove` command. Reports pass/fail for each test. | Use this for a comprehensive end-to-end verification of all features before merging or releasing. |
| `test-statement-store-smoke.sh` | Builds the runtime, starts a temporary local-relay-chain node with Statement Store enabled, verifies the store is initially empty, submits a signed statement through the CLI, and checks that `statement-dump` returns it. | Use this when you want an end-to-end sanity check of the Statement Store integration, especially before merging Statement Store changes. |

## Notes

- `start-dev.sh`, `start-dev-with-contracts.sh`, `start-all.sh`, and `test-statement-store-smoke.sh` depend on local Rust and node tooling such as `cargo`, `chain-spec-builder`, and `polkadot-omni-node`.
- `start-local.sh` and `start-zombienet-all.sh` require both `polkadot` and `zombienet`.
- `start-dev-with-contracts.sh`, `start-all.sh`, `start-zombienet-all.sh`, and `test-zombienet.sh` also require `eth-rpc`.
- `deploy-frontend.sh` requires the `w3` CLI from Web3.Storage.
- `deploy-paseo.sh` expects the contract deployment credentials to already be configured in the contract projects.
