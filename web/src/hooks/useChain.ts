import { createClient, type PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";

let client: PolkadotClient | null = null;
let currentUrl: string | null = null;

export function getClient(wsUrl?: string): PolkadotClient {
  const url = wsUrl || currentUrl || "ws://127.0.0.1:9944";
  if (!client || currentUrl !== url) {
    if (client) {
      client.destroy();
    }
    client = createClient(withPolkadotSdkCompat(getWsProvider(url)));
    currentUrl = url;
  }
  return client;
}

export function disconnectClient() {
  if (client) {
    client.destroy();
    client = null;
    currentUrl = null;
  }
}
