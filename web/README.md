# Web

This directory contains the React frontend for the template.

## Overview

The app uses:

- React + Vite + TypeScript + Tailwind CSS
- [Polkadot API (PAPI)](https://papi.how/) for pallet interaction
- [viem](https://viem.sh/) for EVM and PVM contract interaction through `eth-rpc`
- Zustand for state management

Key pages include:

- Home
- Pallet Proof of Existence
- EVM Proof of Existence
- PVM Proof of Existence
- Statements
- Accounts

## Local Development

Run the frontend directly:

```bash
cd web
npm install
npm run dev
```

Or, from the repo root, if the chain is already running and you want the scripted dev flow:

```bash
./scripts/start-frontend.sh
```

## Endpoint Configuration

The app uses configurable Substrate WebSocket and Ethereum JSON-RPC endpoints.

For hosted builds:

```bash
cp web/.env.example web/.env.local
```

Set:

- `VITE_WS_URL`
- `VITE_ETH_RPC_URL`

For local scripted development, [`../scripts/start-all.sh`](../scripts/start-all.sh) and [`../scripts/start-frontend.sh`](../scripts/start-frontend.sh) export:

- `VITE_LOCAL_WS_URL`
- `VITE_LOCAL_ETH_RPC_URL`

That keeps the browser aligned with the active local stack ports.

## PAPI Descriptors

Generated descriptors live in [`.papi/`](.papi/).

Useful commands:

```bash
cd web
npm run update-types
npm run codegen
npm run build
npm run lint
npm run fmt
```

## Deployment Data

The frontend keeps [`src/config/deployments.ts`](src/config/deployments.ts) checked in as a stub so a fresh clone still works. Contract deploy scripts update that file automatically after successful deployment.

See [`../contracts/README.md`](../contracts/README.md) for contract deployment flows and [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) for hosted frontend deployment options.
