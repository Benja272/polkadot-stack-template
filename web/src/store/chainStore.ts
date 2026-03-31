import { create } from "zustand";

export interface PalletAvailability {
  templatePallet: boolean | null; // null = not checked yet
  revive: boolean | null;
}

interface ChainState {
  wsUrl: string;
  connected: boolean;
  blockNumber: number;
  selectedAccount: number;
  txStatus: string | null;
  pallets: PalletAvailability;
  setWsUrl: (url: string) => void;
  setConnected: (connected: boolean) => void;
  setBlockNumber: (blockNumber: number) => void;
  setSelectedAccount: (index: number) => void;
  setTxStatus: (status: string | null) => void;
  setPallets: (pallets: PalletAvailability) => void;
}

const DEFAULT_WS_URL = "ws://127.0.0.1:9944";

export const useChainStore = create<ChainState>((set) => ({
  wsUrl: localStorage.getItem("ws-url") || DEFAULT_WS_URL,
  connected: false,
  blockNumber: 0,
  selectedAccount: 0,
  txStatus: null,
  pallets: { templatePallet: null, revive: null },
  setWsUrl: (wsUrl) => {
    localStorage.setItem("ws-url", wsUrl);
    set({ wsUrl });
  },
  setConnected: (connected) => set({ connected }),
  setBlockNumber: (blockNumber) => set({ blockNumber }),
  setSelectedAccount: (index) => set({ selectedAccount: index }),
  setTxStatus: (txStatus) => set({ txStatus }),
  setPallets: (pallets) => set({ pallets }),
}));
