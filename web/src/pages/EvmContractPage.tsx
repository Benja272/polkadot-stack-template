export default function EvmContractPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-purple-400">EVM Counter</h1>
      <p className="text-gray-400">
        Interact with the Solidity counter contract deployed via Frontier's
        pallet-evm. This page will use ethers.js to communicate through the
        Ethereum JSON-RPC endpoint.
      </p>

      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 space-y-4">
        <p className="text-yellow-400 text-sm">
          This page requires Frontier (pallet-evm) to be integrated into the
          runtime and the Solidity counter contract to be deployed. See the{" "}
          <code className="bg-gray-800 px-1 rounded">contracts/evm/</code>{" "}
          directory for the contract source and deployment scripts.
        </p>

        <div className="text-gray-400 text-sm space-y-2">
          <p>To deploy and interact with the EVM counter:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Start the local chain:{" "}
              <code className="bg-gray-800 px-1 rounded">
                ./scripts/start-dev.sh
              </code>
            </li>
            <li>
              Deploy the contract:{" "}
              <code className="bg-gray-800 px-1 rounded">
                cd contracts/evm && npm run deploy:local
              </code>
            </li>
            <li>Enter the deployed contract address below</li>
          </ol>
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">
            Contract Address
          </label>
          <input
            type="text"
            placeholder="0x..."
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full"
          />
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm opacity-50 cursor-not-allowed">
            Query Counter
          </button>
          <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-sm opacity-50 cursor-not-allowed">
            Set Counter
          </button>
          <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm opacity-50 cursor-not-allowed">
            Increment
          </button>
        </div>
      </div>
    </div>
  );
}
