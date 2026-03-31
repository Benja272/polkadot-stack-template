import { create } from "zustand";

interface ChainState {
  connected: boolean;
  blockNumber: number;
  selectedAccount: number;
  txStatus: string | null;
  setConnected: (connected: boolean) => void;
  setBlockNumber: (blockNumber: number) => void;
  setSelectedAccount: (index: number) => void;
  setTxStatus: (status: string | null) => void;
}

export const useChainStore = create<ChainState>((set) => ({
  connected: false,
  blockNumber: 0,
  selectedAccount: 0,
  txStatus: null,
  setConnected: (connected) => set({ connected }),
  setBlockNumber: (blockNumber) => set({ blockNumber }),
  setSelectedAccount: (index) => set({ selectedAccount: index }),
  setTxStatus: (txStatus) => set({ txStatus }),
}));
