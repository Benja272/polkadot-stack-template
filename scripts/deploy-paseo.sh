#!/usr/bin/env bash
set -euo pipefail

echo "=== Deploy Contracts to Paseo ==="
echo ""
echo "This script deploys the Solidity and ink! counter contracts to Paseo."
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Deploy Solidity contract
echo "[1/2] Deploying Solidity counter to Paseo..."
echo "  Make sure PRIVATE_KEY is set in your environment."
cd "$ROOT_DIR/contracts/evm"
npm install
npx hardhat run scripts/deploy.ts --network paseo

# Deploy ink! contract
echo "[2/2] Deploying ink! counter to Paseo..."
echo "  Using cargo-contract to deploy to Paseo Asset Hub."
cd "$ROOT_DIR/contracts/ink"
if ! command -v cargo-contract &> /dev/null; then
    echo "  Installing cargo-contract..."
    cargo install cargo-contract
fi
cargo contract build --release
echo "  Use 'cargo contract upload' and 'cargo contract instantiate' to deploy."
echo "  See: https://use.ink/getting-started/deploy-your-contract"

echo ""
echo "=== Deployment complete ==="
