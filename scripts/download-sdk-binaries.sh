#!/usr/bin/env bash
set -euo pipefail

# Fetch polkadot (relay) + prepare/execute workers, polkadot-omni-node, chain-spec-builder,
# eth-rpc, and zombienet into the repo-local bin/ directory (gitignored).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/common.sh"

ensure_local_sdk_binaries polkadot polkadot-prepare-worker polkadot-execute-worker polkadot-omni-node eth-rpc chain-spec-builder
ensure_local_zombienet_binary
log_info "All binaries ready under $STACK_LOCAL_BIN_DIR"
