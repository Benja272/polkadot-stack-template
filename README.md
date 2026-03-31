# Polkadot Stack Template

A developer starter template demonstrating the full Polkadot technology stack through a simple **Counter** - the same concept implemented as a Substrate pallet, a Solidity EVM contract, and a Solidity PVM contract.

## What's Inside

### Substrate Pallet

A FRAME pallet implementing a per-account counter with `set_counter` and `increment` dispatchables.

- **Source**: [`blockchain/pallets/template/`](blockchain/pallets/template/)
- **Features**: Storage, events, errors, benchmarks, weights, mock runtime, 12 unit tests
- **Interact via**: PAPI (frontend), subxt (CLI), or Polkadot.js Apps

### Parachain Runtime

A Cumulus-based parachain runtime built on **polkadot-sdk stable2512** with smart contract support.

- **Source**: [`blockchain/runtime/`](blockchain/runtime/)
- **Pallets included**: System, Balances, Aura, Session, Sudo, XCM, pallet-revive, Counter template
- **pallet-revive**: Enables both EVM and PVM smart contract execution with Ethereum RPC compatibility
- **Runs locally** via `polkadot-omni-node --dev`

### Solidity Smart Contracts

The same `Counter.sol` compiled two ways:

| | EVM (solc) | PVM (resolc) |
|---|---|---|
| **Source** | `contracts/evm/contracts/Counter.sol` | Same file |
| **Toolchain** | [`contracts/evm/`](contracts/evm/) - Hardhat + solc | [`contracts/pvm/`](contracts/pvm/) - Hardhat + @parity/resolc |
| **VM Backend** | REVM (Ethereum-compatible) | PolkaVM (RISC-V) |
| **Deploy** | `npx hardhat ignition deploy` | `npx hardhat ignition deploy` |

Both target **Polkadot Hub TestNet** (Chain ID: `420420417`) or your local dev node.

### PAPI Frontend

A React + Vite + TypeScript + Tailwind CSS frontend using [Polkadot API (PAPI)](https://papi.how/) for chain interaction.

- **Source**: [`web/`](web/)
- **Pages**: Chain dashboard, pallet counter interaction, EVM contract page, PVM contract page
- **State management**: Zustand
- **Dev accounts**: Alice, Bob, Charlie (sr25519 dev keys)

### subxt CLI

A Rust CLI tool using [subxt](https://github.com/parity-tech/subxt) for chain interaction.

- **Source**: [`cli/`](cli/)
- **Commands**: `chain info`, `chain blocks`, `pallet get/set/increment`

### Deployment Scripts

- [`scripts/start-dev.sh`](scripts/start-dev.sh) - Build runtime and start local node
- [`scripts/start-dev-with-contracts.sh`](scripts/start-dev-with-contracts.sh) - Build, start node, compile and deploy contracts
- [`scripts/deploy-paseo.sh`](scripts/deploy-paseo.sh) - Deploy contracts to Polkadot TestNet
- [`blockchain/Dockerfile`](blockchain/Dockerfile) - Docker image using polkadot-omni-node
- [`blockchain/zombienet.toml`](blockchain/zombienet.toml) - Zombienet config for multi-node testing

## Quick Start

### Prerequisites

- **Rust** (stable, installed via [rustup](https://rustup.rs/))
- **Node.js** v22.5+ and npm v10.9.0+
- **polkadot-omni-node** v1.21.3 ([download](https://github.com/paritytech/polkadot-sdk/releases/tag/polkadot-stable2512-3))
- **chain-spec-builder** (`cargo install staging-chain-spec-builder`)

See [INSTALL.md](INSTALL.md) for detailed setup instructions.

### Run locally

```bash
# Start the local dev chain
./scripts/start-dev.sh

# In another terminal, start the frontend
cd web && npm install && npm run dev

# Or use the CLI
cargo run -p stack-cli -- chain info
cargo run -p stack-cli -- pallet set 42
cargo run -p stack-cli -- pallet get alice
```

### Deploy contracts

```bash
# Compile and deploy to local node
cd contracts/evm && npm install && npx hardhat compile
cd contracts/pvm && npm install && npx hardhat compile

# Deploy to Polkadot TestNet
npx hardhat vars set PRIVATE_KEY  # in each contract dir
npx hardhat ignition deploy ./ignition/modules/Counter.js --network polkadotTestnet
```

### Run tests

```bash
# Pallet unit tests
cargo test -p pallet-template

# All tests including benchmarks
SKIP_PALLET_REVIVE_FIXTURES=1 cargo test --workspace --features runtime-benchmarks

# Solidity tests (local Hardhat network)
cd contracts/evm && npx hardhat test
```

## Project Structure

```
polkadot-stack-template/
|-- blockchain/
|   |-- runtime/              Parachain runtime (polkadot-sdk stable2512)
|   |-- pallets/template/     Counter pallet with tests + benchmarks
|   |-- Dockerfile            Docker image for deployment
|   |-- docker-compose.yml    Docker Compose configuration
|   `-- zombienet.toml        Multi-node test network config
|-- contracts/
|   |-- evm/                  Hardhat project (solc -> EVM) with Counter.sol
|   `-- pvm/                  Hardhat project (resolc -> PVM) with Counter.sol
|-- web/                      React + PAPI frontend
|-- cli/                      subxt Rust CLI
|-- scripts/                  Dev and deployment scripts
|-- Cargo.toml                Rust workspace
`-- rust-toolchain.toml       Pinned Rust version
```

## Key Versions

| Component | Version |
|---|---|
| polkadot-sdk | stable2512-3 (umbrella crate v2512.3.3) |
| polkadot-omni-node | v1.21.3 (from stable2512-3 release) |
| pallet-revive | v0.12.2 (EVM + PVM smart contracts) |
| Solidity | v0.8.28 |
| resolc | v1.0.0 |
| PAPI | v1.23.3 |
| React | v18.3 |
| Hardhat | v2.27+ |

## Resources

- [Polkadot Smart Contract Docs](https://docs.polkadot.com/smart-contracts/overview/)
- [Polkadot SDK Documentation](https://paritytech.github.io/polkadot-sdk/master/)
- [PAPI Documentation](https://papi.how/)
- [Polkadot Faucet](https://faucet.polkadot.io/) (TestNet tokens)
- [Blockscout Explorer](https://blockscout-testnet.polkadot.io/) (Polkadot TestNet)

## License

[MIT](LICENSE)
