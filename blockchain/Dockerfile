# Lightweight deployment image — packages a pre-generated chain spec into
# the polkadot-omni-node base image. Builds in seconds (no Rust required).
#
# For local development, use the root docker-compose.yml instead, which
# compiles the runtime and generates the chain spec automatically.
#
# Usage:
#   ./scripts/start-dev.sh            # generates blockchain/chain_spec.json
#   cd blockchain && docker build -t stack-template-node .
#   docker run --rm -p 9944:9944 stack-template-node \
#     --chain=/chain/chain_spec.json --alice --force-authoring \
#     --dev-block-time=3000 --rpc-external --rpc-cors=all \
#     --rpc-methods=unsafe --rpc-port=9944
FROM docker.io/parity/polkadot-omni-node:stable2512-3
COPY chain_spec.json /chain/chain_spec.json
