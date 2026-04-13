#!/usr/bin/env bash
set -euo pipefail

# Fetch polkadot (relay) + prepare/execute workers, polkadot-omni-node, and eth-rpc from
# polkadot-sdk stable2512-3 into the repo-local bin/ directory (gitignored).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/common.sh"

ensure_local_sdk_binaries polkadot polkadot-prepare-worker polkadot-execute-worker polkadot-omni-node eth-rpc
log_info "SDK binaries ready under $STACK_LOCAL_BIN_DIR"
