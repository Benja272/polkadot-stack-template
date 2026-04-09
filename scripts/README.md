# Scripts

This directory contains convenience scripts for the main local development, testing, and deployment flows in this repo.

All scripts resolve the repo root automatically, so you can run them from the repo root with:

```bash
./scripts/<script-name>.sh
```

`start-all.sh` is the recommended full local path when you want the chain, contracts, CLI, and frontend working together.

The local startup scripts coordinate the chain, `eth-rpc`, CLI defaults, contract tooling, PAPI refresh, and frontend from shared environment variables.

By default they use:

- Substrate RPC: `ws://127.0.0.1:9944`
- Ethereum RPC: `http://127.0.0.1:8545`
- Frontend: `http://127.0.0.1:5173`

To move a second local stack together, prefer:

```bash
STACK_PORT_OFFSET=100 ./scripts/start-all.sh
```

You can also override individual ports with `STACK_SUBSTRATE_RPC_PORT`, `STACK_ETH_RPC_PORT`, and `STACK_FRONTEND_PORT`.

When you use an offset or explicit port overrides, the frontend dev server, CLI defaults, Hardhat local network, and PAPI refresh follow the active port settings automatically.

## Script Guide

| Script | What it does | When to use it |
| --- | --- | --- |
| `start-dev.sh` | Builds the runtime, generates `blockchain/chain_spec.json`, and starts a single local omni-node on the resolved Substrate RPC port using dev sealing. | Use this when you only need the fastest local pallet/runtime loop. On stable2512-3, this mode does not expose Statement Store RPCs. |
| `start-frontend.sh` | Installs frontend dependencies, refreshes PAPI descriptors if a local node is running on the resolved Substrate RPC port, and starts the Vite dev server on the resolved frontend port. | Use this when the chain is already running and you only want to work on the web app. |
| `start-all.sh` | Runs the full local stack through Zombienet: runtime build, chain-spec generation, relay chain + parachain startup, Statement Store-ready RPCs, `eth-rpc`, local contract deployment, CLI build, and frontend startup. | Use this when you want the one-command setup with all examples working, including Statement Store. |
| `start-local.sh` | Builds the runtime, regenerates `blockchain/chain_spec.json`, and starts the relay-backed Zombienet network using a temp config generated from the current port settings. | Use this when you want the relay-backed network directly, without the contract/frontend setup steps. |
| `deploy-paseo.sh` | Installs dependencies, compiles, and deploys the EVM and PVM contracts to the Polkadot testnet configuration used by the Hardhat projects. | Use this when you are deploying contract examples to testnet rather than running them locally. Make sure the required `PRIVATE_KEY` values are configured first. |
| `deploy-frontend.sh` | Builds the frontend and uploads `web/dist` to IPFS using the `w3` CLI, then prints the CID and suggested DotNS follow-up steps. | Use this when you want to publish the frontend as a static deployment. |
| `test-zombienet.sh` | Starts a Zombienet network, deploys EVM and PVM contracts, and runs automated E2E tests covering pallet PoE, EVM contract PoE, PVM contract PoE, Statement Store submit/dump, combined pallet+statement-store claims, and the `prove` command. Reports pass/fail for each test. | Use this for a comprehensive end-to-end verification of all features before merging or releasing. |
| `test-statement-store-smoke.sh` | Builds the runtime, starts a temporary Zombienet relay chain + collator with Statement Store enabled, verifies the store is initially empty, submits a signed statement through the CLI, and checks that `statement-dump` returns it. | Use this when you want a focused end-to-end sanity check of the Statement Store integration on the same supported local topology the template documents. |

## Notes

- `start-dev.sh` depends on local Rust and node tooling such as `cargo`, `chain-spec-builder`, and `polkadot-omni-node`.
- `start-all.sh`, `start-local.sh`, `test-statement-store-smoke.sh`, and `test-zombienet.sh` require both `polkadot` and `zombienet`.
- `start-all.sh` and `test-zombienet.sh` also require `eth-rpc`.
- `deploy-frontend.sh` requires the `w3` CLI from Web3.Storage.
- `deploy-paseo.sh` expects the contract deployment credentials to already be configured in the contract projects.
