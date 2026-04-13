#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

echo "=== Polkadot Stack Template - Local Development ==="
echo ""
log_info "This is the fastest local loop for pallet/runtime work."
log_info "Override ports with STACK_PORT_OFFSET or STACK_*_PORT environment variables."
log_info "Typical startup time is under 2 minutes once Rust dependencies are built."
log_info "Statement Store is intentionally unavailable in this solo-node mode."
echo ""

validate_solo_dev_toolchain

# Build the runtime
echo "[1/3] Building runtime..."
build_runtime

# Create the chain spec using the newly built WASM
echo "[2/3] Generating chain spec..."
generate_chain_spec

echo "  Chain spec written to blockchain/chain_spec.json"

# Start the local node
echo "[3/3] Starting local omni-node..."
log_info "RPC endpoint: $SUBSTRATE_RPC_WS"
log_info "Use start-all.sh for the full stack, or start-local.sh for just the relay-backed network."
echo ""
run_local_node_foreground
