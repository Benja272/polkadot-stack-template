import { useState } from "react";
import { useChainStore } from "../store/chainStore";
import { devAccounts } from "../hooks/useAccount";
import { getClient } from "../hooks/useChain";

export default function PalletPage() {
  const { selectedAccount, setSelectedAccount, setTxStatus, txStatus } =
    useChainStore();
  const [counterValue, setCounterValue] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");

  const account = devAccounts[selectedAccount];

  async function queryCounter() {
    try {
      const client = getClient();
      const typedApi = client.getTypedApi(
        (await import("@polkadot-api/descriptors")).stack_template
      );
      // Query counter for the selected account's public key
      const signer = account.signer;
      // We need the account's public key to query storage
      // For now, we'll query using the signer's publicKey
      const value = await typedApi.query.TemplatePallet.Counters.getValue(
        signer.publicKey
      );
      setCounterValue(value);
    } catch (e) {
      console.error("Failed to query counter:", e);
      setTxStatus(`Error: ${e}`);
    }
  }

  async function setCounter() {
    try {
      setTxStatus("Submitting set_counter...");
      const client = getClient();
      const typedApi = client.getTypedApi(
        (await import("@polkadot-api/descriptors")).stack_template
      );
      const tx = typedApi.tx.TemplatePallet.set_counter({
        value: parseInt(inputValue) || 0,
      });
      await tx.signAndSubmit(account.signer);
      setTxStatus("set_counter submitted successfully!");
      queryCounter();
    } catch (e) {
      console.error("Transaction failed:", e);
      setTxStatus(`Error: ${e}`);
    }
  }

  async function increment() {
    try {
      setTxStatus("Submitting increment...");
      const client = getClient();
      const typedApi = client.getTypedApi(
        (await import("@polkadot-api/descriptors")).stack_template
      );
      const tx = typedApi.tx.TemplatePallet.increment();
      await tx.signAndSubmit(account.signer);
      setTxStatus("increment submitted successfully!");
      queryCounter();
    } catch (e) {
      console.error("Transaction failed:", e);
      setTxStatus(`Error: ${e}`);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-blue-400">Pallet Counter</h1>
      <p className="text-gray-400">
        Interact with the counter implemented as a Substrate FRAME pallet. Uses
        PAPI to read storage and submit signed extrinsics.
      </p>

      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 space-y-4">
        <div>
          <label className="text-sm text-gray-400 block mb-1">
            Dev Account
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(parseInt(e.target.value))}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white w-full"
          >
            {devAccounts.map((acc, i) => (
              <option key={i} value={i}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <button
            onClick={queryCounter}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
          >
            Query Counter
          </button>
          <span className="text-lg font-mono self-center">
            Value: {counterValue !== null ? counterValue : "—"}
          </span>
        </div>

        <div className="flex gap-3">
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Enter value"
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white flex-1"
          />
          <button
            onClick={setCounter}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
          >
            Set Counter
          </button>
        </div>

        <button
          onClick={increment}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
        >
          Increment
        </button>

        {txStatus && (
          <p
            className={`text-sm ${txStatus.startsWith("Error") ? "text-red-400" : "text-green-400"}`}
          >
            {txStatus}
          </p>
        )}
      </div>
    </div>
  );
}
