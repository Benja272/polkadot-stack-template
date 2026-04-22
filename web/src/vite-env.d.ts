/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_WS_URL?: string;
	readonly VITE_ETH_RPC_URL?: string;
	readonly VITE_LOCAL_WS_URL?: string;
	readonly VITE_LOCAL_ETH_RPC_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
