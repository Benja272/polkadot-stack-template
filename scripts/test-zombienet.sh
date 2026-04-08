#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/common.sh"

ETH_RPC_PID=""

cleanup() {
    if [ -n "$ETH_RPC_PID" ]; then
        kill "$ETH_RPC_PID" 2>/dev/null || true
        wait "$ETH_RPC_PID" 2>/dev/null || true
    fi
    cleanup_zombienet
    rm -rf "${TMP_DIR:-}"
}
trap cleanup EXIT INT TERM

TMP_DIR="$(mktemp -d)"
CLI="cargo run -q -p stack-cli --"
WS_URL="ws://127.0.0.1:9944"
ETH_URL="http://127.0.0.1:8545"

PASSED=0
FAILED=0
FAILURES=""

pass() {
    PASSED=$((PASSED + 1))
    echo "  PASS: $1"
}

fail() {
    FAILED=$((FAILED + 1))
    FAILURES="${FAILURES}\n  - $1"
    echo "  FAIL: $1"
}

check() {
    local name="$1"
    shift
    if "$@" >/dev/null 2>&1; then
        pass "$name"
    else
        fail "$name"
    fi
}

echo "=== Polkadot Stack Template - Zombienet E2E Test ==="
echo ""

# -----------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------
echo "[1/7] Building runtime and CLI..."
build_runtime
cargo build -p stack-cli --release

echo "[2/7] Generating chain spec..."
generate_chain_spec

echo "[3/7] Compiling contracts..."
cd "$ROOT_DIR/contracts/evm" && npm install --silent && npx hardhat compile
cd "$ROOT_DIR/contracts/pvm" && npm install --silent && npx hardhat compile
cd "$ROOT_DIR"

echo "[4/7] Starting Zombienet..."
start_zombienet_background
wait_for_substrate_rpc

echo "[5/7] Starting eth-rpc adapter..."
start_eth_rpc_background
wait_for_eth_rpc

echo "[6/7] Deploying contracts..."
cd "$ROOT_DIR/contracts/evm" && npm run deploy:local
cd "$ROOT_DIR/contracts/pvm" && npm run deploy:local
cd "$ROOT_DIR"

echo "[7/7] Running tests..."
echo ""

# -----------------------------------------------------------------------
# Test: Chain info
# -----------------------------------------------------------------------
echo "--- Chain ---"
CHAIN_INFO="$($CLI --url "$WS_URL" chain info 2>&1)"
check "chain info returns genesis hash" grep -q "Genesis Hash" <<<"$CHAIN_INFO"

# -----------------------------------------------------------------------
# Test: Pallet PoE
# -----------------------------------------------------------------------
echo "--- Pallet PoE ---"

# Create a test file
PALLET_FILE="$TMP_DIR/pallet-test.txt"
echo "pallet-poe-test-$(date +%s)" >"$PALLET_FILE"

# Create claim
CREATE_OUT="$($CLI --url "$WS_URL" pallet create-claim --file "$PALLET_FILE" -s alice 2>&1)"
PALLET_HASH="$(grep -oE '0x[0-9a-f]{64}' <<<"$CREATE_OUT" | head -1)"

if [ -n "$PALLET_HASH" ]; then
    pass "pallet create-claim"
else
    fail "pallet create-claim (could not extract hash)"
fi

# Get claim
if [ -n "$PALLET_HASH" ]; then
    GET_OUT="$($CLI --url "$WS_URL" pallet get-claim "$PALLET_HASH" 2>&1)"
    check "pallet get-claim finds owner" grep -q "Owner" <<<"$GET_OUT"
fi

# List claims
LIST_OUT="$($CLI --url "$WS_URL" pallet list-claims 2>&1)"
if [ -n "$PALLET_HASH" ]; then
    check "pallet list-claims contains hash" grep -q "$PALLET_HASH" <<<"$LIST_OUT"
else
    check "pallet list-claims has results" grep -q "claim(s) total" <<<"$LIST_OUT"
fi

# Revoke claim
if [ -n "$PALLET_HASH" ]; then
    REVOKE_OUT="$($CLI --url "$WS_URL" pallet revoke-claim "$PALLET_HASH" -s alice 2>&1)"
    check "pallet revoke-claim" grep -q "revoke_claim finalized" <<<"$REVOKE_OUT"

    # Verify revoked
    GET_AFTER="$($CLI --url "$WS_URL" pallet get-claim "$PALLET_HASH" 2>&1)"
    check "pallet claim gone after revoke" grep -q "No claim found" <<<"$GET_AFTER"
fi

# -----------------------------------------------------------------------
# Test: EVM Contract PoE
# -----------------------------------------------------------------------
echo "--- EVM Contract PoE ---"

EVM_FILE="$TMP_DIR/evm-test.txt"
echo "evm-poe-test-$(date +%s)" >"$EVM_FILE"

EVM_CREATE="$($CLI --url "$WS_URL" --eth-rpc-url "$ETH_URL" contract create-claim evm --file "$EVM_FILE" -s alice 2>&1)"
EVM_HASH="$(grep -oE '0x[0-9a-f]{64}' <<<"$EVM_CREATE" | head -1)"

if [ -n "$EVM_HASH" ]; then
    pass "evm contract create-claim"
else
    fail "evm contract create-claim (could not extract hash)"
fi

if [ -n "$EVM_HASH" ]; then
    EVM_GET="$($CLI --url "$WS_URL" --eth-rpc-url "$ETH_URL" contract get-claim evm "$EVM_HASH" 2>&1)"
    check "evm contract get-claim finds owner" grep -q "Owner" <<<"$EVM_GET"
fi

# -----------------------------------------------------------------------
# Test: PVM Contract PoE
# -----------------------------------------------------------------------
echo "--- PVM Contract PoE ---"

PVM_FILE="$TMP_DIR/pvm-test.txt"
echo "pvm-poe-test-$(date +%s)" >"$PVM_FILE"

PVM_CREATE="$($CLI --url "$WS_URL" --eth-rpc-url "$ETH_URL" contract create-claim pvm --file "$PVM_FILE" -s alice 2>&1)"
PVM_HASH="$(grep -oE '0x[0-9a-f]{64}' <<<"$PVM_CREATE" | head -1)"

if [ -n "$PVM_HASH" ]; then
    pass "pvm contract create-claim"
else
    fail "pvm contract create-claim (could not extract hash)"
fi

if [ -n "$PVM_HASH" ]; then
    PVM_GET="$($CLI --url "$WS_URL" --eth-rpc-url "$ETH_URL" contract get-claim pvm "$PVM_HASH" 2>&1)"
    check "pvm contract get-claim finds owner" grep -q "Owner" <<<"$PVM_GET"
fi

# -----------------------------------------------------------------------
# Test: Statement Store
# -----------------------------------------------------------------------
echo "--- Statement Store ---"

# Verify statement_submit RPC is available (zombienet specific)
check "statement store RPC available" substrate_statement_store_ready

# Check store starts with expected state
DUMP_BEFORE="$($CLI --url "$WS_URL" chain statement-dump 2>&1)"
STMT_COUNT_BEFORE="$(grep -c "hash=0x" <<<"$DUMP_BEFORE" || true)"
STMT_COUNT_BEFORE="${STMT_COUNT_BEFORE:-0}"

# Submit a statement directly
STMT_FILE="$TMP_DIR/statement-test.txt"
echo "statement-store-e2e-$(date +%s)" >"$STMT_FILE"

STMT_SUBMIT="$($CLI --url "$WS_URL" chain statement-submit --file "$STMT_FILE" --signer alice 2>&1)"
STMT_HASH="$(grep -oE '0x[0-9a-f]{64}' <<<"$STMT_SUBMIT" | tail -1)"

if [ -n "$STMT_HASH" ]; then
    pass "statement store submit"
else
    fail "statement store submit (could not extract hash)"
fi

# Dump and verify
DUMP_AFTER="$($CLI --url "$WS_URL" chain statement-dump 2>&1)"
STMT_COUNT_AFTER="$(grep -c "hash=0x" <<<"$DUMP_AFTER" || true)"
STMT_COUNT_AFTER="${STMT_COUNT_AFTER:-0}"

if [ "$STMT_COUNT_AFTER" -gt "$STMT_COUNT_BEFORE" ]; then
    pass "statement store dump shows new statement"
else
    fail "statement store dump count did not increase ($STMT_COUNT_BEFORE -> $STMT_COUNT_AFTER)"
fi

if [ -n "$STMT_HASH" ]; then
    check "statement store dump contains submitted hash" grep -q "$STMT_HASH" <<<"$DUMP_AFTER"
    check "statement has proof" grep -q "proof=true" <<<"$DUMP_AFTER"
fi

# -----------------------------------------------------------------------
# Test: Pallet create-claim with --statement-store flag
# -----------------------------------------------------------------------
echo "--- Pallet + Statement Store combined ---"

COMBO_FILE="$TMP_DIR/combo-test.txt"
echo "combo-pallet-statement-$(date +%s)" >"$COMBO_FILE"

COMBO_OUT="$($CLI --url "$WS_URL" pallet create-claim --file "$COMBO_FILE" --statement-store -s alice 2>&1)"
COMBO_HASH="$(grep -oE '0x[0-9a-f]{64}' <<<"$COMBO_OUT" | head -1)"

if [ -n "$COMBO_HASH" ]; then
    pass "pallet create-claim --statement-store"
else
    fail "pallet create-claim --statement-store (could not extract hash)"
fi

# Verify both pallet claim and statement store entry exist
if [ -n "$COMBO_HASH" ]; then
    COMBO_GET="$($CLI --url "$WS_URL" pallet get-claim "$COMBO_HASH" 2>&1)"
    check "combo: pallet claim exists" grep -q "Owner" <<<"$COMBO_GET"

    COMBO_DUMP="$($CLI --url "$WS_URL" chain statement-dump 2>&1)"
    COMBO_STMT_COUNT="$(grep -c "hash=0x" <<<"$COMBO_DUMP" || true)"
    COMBO_STMT_COUNT="${COMBO_STMT_COUNT:-0}"
    if [ "$COMBO_STMT_COUNT" -gt "$STMT_COUNT_AFTER" ]; then
        pass "combo: statement store has new entry"
    else
        fail "combo: statement store count did not increase"
    fi
fi

# -----------------------------------------------------------------------
# Test: prove command (all-in-one)
# -----------------------------------------------------------------------
echo "--- Prove command ---"

PROVE_FILE="$TMP_DIR/prove-test.txt"
echo "prove-e2e-$(date +%s)" >"$PROVE_FILE"

PROVE_OUT="$($CLI --url "$WS_URL" --eth-rpc-url "$ETH_URL" prove --file "$PROVE_FILE" --statement-store -s alice 2>&1)"
check "prove command succeeds" grep -q "finalized" <<<"$PROVE_OUT"

PROVE_CONTRACT_FILE="$TMP_DIR/prove-contract-test.txt"
echo "prove-contract-e2e-$(date +%s)" >"$PROVE_CONTRACT_FILE"

PROVE_EVM_OUT="$($CLI --url "$WS_URL" --eth-rpc-url "$ETH_URL" prove --file "$PROVE_CONTRACT_FILE" --contract evm -s alice 2>&1)"
check "prove --contract evm succeeds" grep -q "Confirmed in block" <<<"$PROVE_EVM_OUT"

# -----------------------------------------------------------------------
# Results
# -----------------------------------------------------------------------
echo ""
echo "==============================="
echo "  Results: $PASSED passed, $FAILED failed"
echo "==============================="

if [ "$FAILED" -gt 0 ]; then
    echo ""
    echo "  Failures:"
    echo -e "$FAILURES"
    echo ""
    exit 1
fi

echo ""
echo "All tests passed."
