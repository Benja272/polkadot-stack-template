import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    local: {
      // Frontier EVM RPC endpoint on the local parachain
      url: "http://127.0.0.1:9944",
      // Alice's Ethereum-compatible private key (for dev chains)
      accounts: [
        "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133",
      ],
    },
    paseo: {
      // Paseo Asset Hub EVM endpoint (update when available)
      url: "https://paseo-asset-hub-eth-rpc.polkadot.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
