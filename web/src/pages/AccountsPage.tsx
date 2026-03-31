import { useState, useEffect } from "react";
import { useChainStore } from "../store/chainStore";
import { devAccounts } from "../hooks/useAccount";
import { evmDevAccounts } from "../config/evm";
import { getClient } from "../hooks/useChain";
import { stack_template } from "@polkadot-api/descriptors";
import {
  getInjectedExtensions,
  connectInjectedExtension,
  type InjectedPolkadotAccount,
} from "polkadot-api/pjs-signer";

interface DisplayAccount {
  name: string;
  ss58: string;
  eth: string;
  type: "dev" | "extension";
  signer?: unknown;
}

function formatDispatchError(err: unknown): string {
  if (!err) return "Transaction failed";
  const e = err as { type?: string; value?: { type?: string } };
  if (e.type === "Module" && e.value) {
    return `${e.value.type ?? "Unknown error"}`;
  }
  return JSON.stringify(err);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleCopy}
      className="px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-300"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function AccountsPage() {
  const { wsUrl, connected } = useChainStore();
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [extensionAccounts, setExtensionAccounts] = useState<
    InjectedPolkadotAccount[]
  >([]);
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null);
  const [fundStatus, setFundStatus] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState("10000");

  // Build dev account display list
  const devDisplayAccounts: DisplayAccount[] = devAccounts.map((acc, i) => ({
    name: acc.name,
    ss58: acc.address,
    eth: evmDevAccounts[i]?.account.address ?? "N/A",
    type: "dev",
  }));

  // Detect available wallets on mount
  useEffect(() => {
    try {
      const wallets = getInjectedExtensions();
      setAvailableWallets(wallets);
    } catch {
      // No injected extensions available
    }
  }, []);

  async function connectWallet(name: string) {
    try {
      const ext = await connectInjectedExtension(name);
      const accounts = ext.getAccounts();
      setExtensionAccounts(accounts);
      setConnectedWallet(name);
      ext.subscribe((updated) => setExtensionAccounts(updated));
    } catch (e) {
      console.error("Failed to connect wallet:", e);
      setFundStatus(`Error connecting wallet: ${e instanceof Error ? e.message : e}`);
    }
  }

  function disconnectWallet() {
    setExtensionAccounts([]);
    setConnectedWallet(null);
  }

  async function fundAccount(ss58Address: string, accountName: string) {
    if (!connected) {
      setFundStatus("Error: Not connected to chain");
      return;
    }
    try {
      const amount = BigInt(fundAmount) * 1_000_000_000_000n; // Convert to planck (12 decimals)
      setFundStatus(`Funding ${accountName}...`);
      const client = getClient(wsUrl);
      const api = client.getTypedApi(stack_template);
      const aliceSigner = devAccounts[0].signer;

      const tx = api.tx.Sudo.sudo({
        call: api.tx.Balances.force_set_balance({
          who: { type: "Id", value: ss58Address },
          new_free: amount,
        }).decodedCall,
      });
      const result = await tx.signAndSubmit(aliceSigner);
      if (!result.ok) {
        setFundStatus(`Error: ${formatDispatchError(result.dispatchError)}`);
        return;
      }
      setFundStatus(`Funded ${accountName} with ${fundAmount} tokens!`);
    } catch (e) {
      console.error("Fund failed:", e);
      setFundStatus(`Error: ${e instanceof Error ? e.message : e}`);
    }
  }

  const walletNames: Record<string, string> = {
    "polkadot-js": "Polkadot.js",
    "subwallet-js": "SubWallet",
    talisman: "Talisman",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-pink-400">Accounts</h1>
      <p className="text-gray-400">
        Manage dev accounts and connect browser extension wallets. Fund accounts
        using Sudo on the dev chain.
      </p>

      {/* Fund amount */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 space-y-3">
        <h2 className="text-lg font-semibold text-gray-300">Funding</h2>
        <div className="flex gap-3 items-center">
          <label className="text-sm text-gray-400">Amount (tokens):</label>
          <input
            type="number"
            value={fundAmount}
            onChange={(e) => setFundAmount(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-white w-40 text-sm"
          />
        </div>
        {fundStatus && (
          <p
            className={`text-sm ${fundStatus.startsWith("Error") ? "text-red-400" : "text-green-400"}`}
          >
            {fundStatus}
          </p>
        )}
      </div>

      {/* Dev Accounts */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-300">Dev Accounts</h2>
        <p className="text-sm text-gray-500">
          Pre-funded accounts from the well-known dev seed phrase.
        </p>
        <div className="space-y-3">
          {devDisplayAccounts.map((acc) => (
            <AccountCard
              key={acc.ss58}
              account={acc}
              onFund={() => fundAccount(acc.ss58, acc.name)}
              connected={connected}
            />
          ))}
        </div>
      </div>

      {/* Extension Wallets */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 space-y-4">
        <h2 className="text-lg font-semibold text-gray-300">
          Browser Extension Wallets
        </h2>
        {connectedWallet ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-sm text-green-400">
                Connected to {walletNames[connectedWallet] || connectedWallet}
              </span>
              <button
                onClick={disconnectWallet}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs"
              >
                Disconnect
              </button>
            </div>
            {extensionAccounts.length === 0 ? (
              <p className="text-sm text-gray-500">
                No accounts found in this wallet.
              </p>
            ) : (
              extensionAccounts.map((acc) => (
                <AccountCard
                  key={acc.address}
                  account={{
                    name: acc.name || "Unnamed",
                    ss58: acc.address,
                    eth: "N/A",
                    type: "extension",
                  }}
                  onFund={() =>
                    fundAccount(acc.address, acc.name || "Extension account")
                  }
                  connected={connected}
                />
              ))
            )}
          </div>
        ) : availableWallets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {availableWallets.map((name) => (
              <button
                key={name}
                onClick={() => connectWallet(name)}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-700 rounded text-white text-sm"
              >
                Connect {walletNames[name] || name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No browser extension wallets detected. Install{" "}
            <a
              href="https://polkadot.js.org/extension/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 underline"
            >
              Polkadot.js
            </a>
            ,{" "}
            <a
              href="https://www.talisman.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 underline"
            >
              Talisman
            </a>
            , or{" "}
            <a
              href="https://www.subwallet.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-400 underline"
            >
              SubWallet
            </a>{" "}
            to connect.
          </p>
        )}
      </div>
    </div>
  );
}

function AccountCard({
  account,
  onFund,
  connected,
}: {
  account: DisplayAccount;
  onFund: () => void;
  connected: boolean;
}) {
  return (
    <div className="bg-gray-800 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-200">{account.name}</span>
        <div className="flex gap-2">
          {connected && (
            <button
              onClick={onFund}
              className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 rounded text-white text-xs"
            >
              Fund
            </button>
          )}
          <span
            className={`px-2 py-0.5 rounded text-xs ${
              account.type === "dev"
                ? "bg-blue-900 text-blue-300"
                : "bg-purple-900 text-purple-300"
            }`}
          >
            {account.type === "dev" ? "Dev" : "Extension"}
          </span>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 w-8">SS58</span>
          <code className="text-xs text-gray-300 font-mono break-all flex-1">
            {account.ss58}
          </code>
          <CopyButton text={account.ss58} />
        </div>
        {account.eth !== "N/A" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-8">ETH</span>
            <code className="text-xs text-gray-300 font-mono break-all flex-1">
              {account.eth}
            </code>
            <CopyButton text={account.eth} />
          </div>
        )}
      </div>
    </div>
  );
}
