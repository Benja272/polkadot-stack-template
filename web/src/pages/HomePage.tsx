import { useEffect, useState } from "react";
import { getClient } from "../hooks/useChain";
import { useChainStore } from "../store/chainStore";

export default function HomePage() {
  const { connected, blockNumber, setConnected, setBlockNumber } =
    useChainStore();
  const [chainName, setChainName] = useState<string>("...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;

    async function connect() {
      try {
        const client = getClient();
        const chain = await client.getChainSpecData();
        setChainName(chain.name);
        setConnected(true);

        unsub = client.finalizedBlock$.subscribe((block) => {
          setBlockNumber(block.number);
        }).unsubscribe;
      } catch (e) {
        setError(
          "Could not connect to node at ws://127.0.0.1:9944. Is the chain running?"
        );
        console.error(e);
      }
    }

    connect();
    return () => unsub?.();
  }, [setConnected, setBlockNumber]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Polkadot Stack Template</h1>
      <p className="text-gray-400">
        A developer starter template demonstrating the same Counter concept
        implemented three ways: as a Substrate pallet, a Solidity EVM contract,
        and an ink! PVM contract.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-1">
            Chain Status
          </h3>
          <p className="text-xl font-bold">
            {error ? (
              <span className="text-red-400 text-sm">{error}</span>
            ) : connected ? (
              <span className="text-green-400">Connected</span>
            ) : (
              <span className="text-yellow-400">Connecting...</span>
            )}
          </p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-1">
            Chain Name
          </h3>
          <p className="text-xl font-bold">{chainName}</p>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <h3 className="text-sm font-medium text-gray-400 mb-1">
            Latest Block
          </h3>
          <p className="text-xl font-bold font-mono">#{blockNumber}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <Card
          title="Pallet Counter"
          description="Interact with the counter implemented as a Substrate FRAME pallet using PAPI."
          link="/pallet"
          color="text-blue-400"
        />
        <Card
          title="EVM Counter"
          description="Interact with the Solidity counter deployed via Frontier's pallet-evm."
          link="/evm"
          color="text-purple-400"
        />
        <Card
          title="PVM Counter"
          description="Interact with the ink! counter deployed via pallet-revive (PolkaVM)."
          link="/pvm"
          color="text-green-400"
        />
      </div>
    </div>
  );
}

function Card({
  title,
  description,
  link,
  color,
}: {
  title: string;
  description: string;
  link: string;
  color: string;
}) {
  return (
    <a
      href={`#${link}`}
      className="bg-gray-900 rounded-lg p-5 border border-gray-800 hover:border-gray-600 transition-colors block"
    >
      <h3 className={`text-lg font-semibold mb-2 ${color}`}>{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </a>
  );
}
