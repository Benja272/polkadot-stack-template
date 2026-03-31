import { createClient, type PolkadotClient } from "polkadot-api";
import { getWsProvider } from "polkadot-api/ws-provider/web";
import { withPolkadotSdkCompat } from "polkadot-api/polkadot-sdk-compat";

let client: PolkadotClient | null = null;

const WS_URL = "ws://127.0.0.1:9944";

export function getClient(): PolkadotClient {
  if (!client) {
    client = createClient(withPolkadotSdkCompat(getWsProvider(WS_URL)));
  }
  return client;
}

export function disconnectClient() {
  if (client) {
    client.destroy();
    client = null;
  }
}
