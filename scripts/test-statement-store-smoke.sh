#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/common.sh"

WS_URL="$SUBSTRATE_RPC_WS"

cleanup() {
  cleanup_zombienet
  rm -rf "${TMP_DIR:-}"
}

trap cleanup EXIT

TMP_DIR="$(mktemp -d)"
TEST_FILE="$TMP_DIR/statement.txt"

echo "=== Statement Store Smoke Test ==="
echo ""
log_info "Testing against $WS_URL"
echo ""

require_command cargo
require_command curl

validate_zombienet_toolchain

echo "[1/6] Building runtime..."
build_runtime

echo "[2/6] Generating chain spec..."
generate_chain_spec

echo "[3/6] Starting local Zombienet with Statement Store enabled..."
start_zombienet_background
wait_for_substrate_rpc

echo "[4/6] Verifying the store starts empty..."
EMPTY_DUMP="$(cargo run -q -p stack-cli -- --url "$WS_URL" chain statement-dump)"
if ! grep -q "No statements in the store." <<<"$EMPTY_DUMP"; then
  echo "Expected an empty store, got:"
  echo "$EMPTY_DUMP"
  exit 1
fi

echo "[5/6] Submitting a signed statement..."
cat >"$TEST_FILE" <<'EOF'
statement-store-smoke
EOF

SUBMIT_OUTPUT="$(cargo run -q -p stack-cli -- --url "$WS_URL" chain statement-submit --file "$TEST_FILE" --signer alice)"
STATEMENT_HASH="$(
  grep -E "Statement hash:|Hash:" <<<"$SUBMIT_OUTPUT" | awk '{print $NF}'
)"

if [[ -z "$STATEMENT_HASH" ]]; then
  echo "Could not parse statement hash from submit output:"
  echo "$SUBMIT_OUTPUT"
  exit 1
fi

echo "[6/6] Dumping statements and checking the submitted hash is present..."
DUMP_OUTPUT="$(cargo run -q -p stack-cli -- --url "$WS_URL" chain statement-dump)"

if ! grep -q "$STATEMENT_HASH" <<<"$DUMP_OUTPUT"; then
  echo "Submitted statement hash $STATEMENT_HASH not found in dump:"
  echo "$DUMP_OUTPUT"
  exit 1
fi

if ! grep -q "proof=true" <<<"$DUMP_OUTPUT"; then
  echo "Expected the dumped statement to include a proof:"
  echo "$DUMP_OUTPUT"
  exit 1
fi

echo ""
echo "Smoke test passed."
