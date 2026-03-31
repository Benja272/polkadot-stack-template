export default function PvmContractPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-green-400">PVM Counter</h1>
      <p className="text-gray-400">
        Interact with the ink! counter contract deployed via pallet-revive
        (PolkaVM). This page will use PAPI to call the contract through
        pallet-revive's extrinsics.
      </p>

      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 space-y-4">
        <p className="text-yellow-400 text-sm">
          This page requires pallet-revive to be integrated into the runtime and
          the ink! counter contract to be deployed. See the{" "}
          <code className="bg-gray-800 px-1 rounded">contracts/ink/</code>{" "}
          directory for the contract source.
        </p>

        <div className="text-gray-400 text-sm space-y-2">
          <p>To deploy and interact with the PVM counter:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Start the local chain:{" "}
              <code className="bg-gray-800 px-1 rounded">
                ./scripts/start-dev.sh
              </code>
            </li>
            <li>
              Build the contract:{" "}
              <code className="bg-gray-800 px-1 rounded">
                cd contracts/ink && cargo contract build
              </code>
            </li>
            <li>
              Deploy with cargo-contract or PAPI
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
            placeholder="5C..."
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full"
          />
        </div>

        <div className="flex gap-3">
          <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm opacity-50 cursor-not-allowed">
            Query Counter
          </button>
          <button className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm opacity-50 cursor-not-allowed">
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
