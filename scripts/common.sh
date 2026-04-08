#!/usr/bin/env bash
set -euo pipefail

COMMON_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$COMMON_DIR/.." && pwd)"
CHAIN_SPEC="$ROOT_DIR/blockchain/chain_spec.json"
RUNTIME_WASM="$ROOT_DIR/target/release/wbuild/stack-template-runtime/stack_template_runtime.compact.compressed.wasm"
SUBSTRATE_RPC_HTTP="${SUBSTRATE_RPC_HTTP:-http://127.0.0.1:9944}"
SUBSTRATE_RPC_WS="${SUBSTRATE_RPC_WS:-ws://127.0.0.1:9944}"
ETH_RPC_HTTP="${ETH_RPC_HTTP:-http://127.0.0.1:8545}"

ZOMBIE_DIR="${ZOMBIE_DIR:-}"
ZOMBIE_LOG="${ZOMBIE_LOG:-}"
ZOMBIE_PID="${ZOMBIE_PID:-}"
ETH_RPC_PID="${ETH_RPC_PID:-}"

require_command() {
    if ! command -v "$1" >/dev/null 2>&1; then
        echo "ERROR: Missing required command: $1" >&2
        exit 1
    fi
}

require_port_free() {
    local port="$1"
    if lsof -i :"$port" >/dev/null 2>&1; then
        echo "ERROR: Port $port is already in use." >&2
        lsof -i :"$port" 2>/dev/null | head -5 >&2
        echo "Kill the process above or choose a different port." >&2
        exit 1
    fi
}

build_runtime() {
    cargo build -p stack-template-runtime --release
}

generate_chain_spec() {
    chain-spec-builder \
        -c "$CHAIN_SPEC" \
        create \
        --chain-name "Polkadot Stack Template" \
        --chain-id "polkadot-stack-template" \
        -t development \
        --relay-chain rococo-local \
        --para-id 1000 \
        --runtime "$RUNTIME_WASM" \
        named-preset development
}

substrate_statement_store_ready() {
    curl -s \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":1,"method":"rpc_methods","params":[]}' \
        "$SUBSTRATE_RPC_HTTP" | grep -q '"statement_submit"'
}

wait_for_substrate_rpc() {
    echo "  Waiting for local relay chain + collator..."
    for _ in $(seq 1 120); do
        if substrate_statement_store_ready; then
            echo "  Node ready ($SUBSTRATE_RPC_WS, Statement Store RPCs enabled)"
            return 0
        fi
        if [ -n "$ZOMBIE_PID" ] && ! kill -0 "$ZOMBIE_PID" 2>/dev/null; then
            echo "  ERROR: Local network stopped during startup."
            if [ -n "$ZOMBIE_LOG" ] && [ -f "$ZOMBIE_LOG" ]; then
                tail -n 100 "$ZOMBIE_LOG" || true
            fi
            return 1
        fi
        sleep 1
    done

    echo "  ERROR: Statement Store RPCs did not become ready in time."
    if [ -n "$ZOMBIE_LOG" ] && [ -f "$ZOMBIE_LOG" ]; then
        tail -n 100 "$ZOMBIE_LOG" || true
    fi
    return 1
}

eth_rpc_ready() {
    curl -s \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
        "$ETH_RPC_HTTP" >/dev/null 2>&1
}

wait_for_eth_rpc() {
    local eth_rpc_log="$ZOMBIE_DIR/eth-rpc.log"

    echo "  Waiting for Ethereum RPC..."
    for _ in $(seq 1 120); do
        if eth_rpc_ready; then
            echo "  Ethereum RPC ready ($ETH_RPC_HTTP)"
            return 0
        fi
        if [ -n "$ETH_RPC_PID" ] && ! kill -0 "$ETH_RPC_PID" 2>/dev/null; then
            echo "  ERROR: eth-rpc stopped during startup."
            if [ -f "$eth_rpc_log" ]; then
                tail -n 100 "$eth_rpc_log" || true
            fi
            return 1
        fi
        sleep 1
    done

    echo "  ERROR: Ethereum RPC did not become ready in time."
    if [ -f "$eth_rpc_log" ]; then
        tail -n 100 "$eth_rpc_log" || true
    fi
    return 1
}

start_zombienet_background() {
    require_command zombienet
    require_command polkadot
    require_command polkadot-omni-node
    require_port_free 9944
    require_port_free 8545

    ZOMBIE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/polkadot-stack-zombienet.XXXXXX")"
    ZOMBIE_LOG="$ZOMBIE_DIR/zombienet.log"

    (
        cd "$ROOT_DIR/blockchain"
        zombienet -p native -f -l text -d "$ZOMBIE_DIR" spawn zombienet.toml >"$ZOMBIE_LOG" 2>&1
    ) &
    ZOMBIE_PID=$!

    echo "  Zombienet dir: $ZOMBIE_DIR"
    echo "  Zombienet log: $ZOMBIE_LOG"
}

run_zombienet_foreground() {
    require_command zombienet
    require_command polkadot
    require_command polkadot-omni-node
    require_port_free 9944

    ZOMBIE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/polkadot-stack-zombienet.XXXXXX")"
    ZOMBIE_LOG="$ZOMBIE_DIR/zombienet.log"

    echo "  Zombienet dir: $ZOMBIE_DIR"
    echo "  Zombienet log: $ZOMBIE_LOG"

    trap cleanup_zombienet EXIT INT TERM

    cd "$ROOT_DIR/blockchain"
    zombienet -p native -f -l text -d "$ZOMBIE_DIR" spawn zombienet.toml &
    ZOMBIE_PID=$!
    wait "$ZOMBIE_PID"
}

start_eth_rpc_background() {
    require_command eth-rpc

    local eth_rpc_log="$ZOMBIE_DIR/eth-rpc.log"
    eth-rpc \
        --node-rpc-url "$SUBSTRATE_RPC_WS" \
        --no-prometheus \
        -d "$ZOMBIE_DIR/eth-rpc" >"$eth_rpc_log" 2>&1 &
    ETH_RPC_PID=$!

    echo "  eth-rpc log: $eth_rpc_log"
}

cleanup_zombienet() {
    if [ -n "$ZOMBIE_DIR" ]; then
        pkill -INT -f "$ZOMBIE_DIR" 2>/dev/null || true
        sleep 1
        pkill -KILL -f "$ZOMBIE_DIR" 2>/dev/null || true
    fi
    if [ -n "$ZOMBIE_PID" ]; then
        wait "$ZOMBIE_PID" 2>/dev/null || true
    fi
}
