# External Dependency Issues

Running log of problems encountered with external tools, libraries, chains, and APIs.
Log an issue as soon as it is found — do not spend more than 2 hours on an unlogged problem.

## How to log an issue

Copy the template below, fill it in, and add it under the relevant section.

```
### [Tool/Library/Chain name] — [short description]
- **Date**: YYYY-MM-DD
- **Phase**: Phase N
- **Version**: x.y.z (or commit hash)
- **Symptom**: What went wrong / what error appeared
- **Root cause**: What caused it (if known)
- **Workaround**: What we did instead
- **Status**: Open | Resolved | Blocked
- **Notes**: Anything else relevant
```

---

## resolc / pallet-revive

_No issues logged yet._

---

## Semaphore v4

_No issues logged yet._

---

## @zk-kit (eddsa-poseidon, lean-imt, poseidon-cipher)

_No issues logged yet._

---

## Circom / snarkjs

_No issues logged yet._

---

## People Chain (Paseo testnet)

_No issues logged yet._

---

## Asset Hub (Paseo testnet)

### Asset Hub — Statement Store RPC not available on Asset Hub
- **Date**: 2026-04-22
- **Phase**: Phase 5.2
- **Symptom**: `statement_submit` / `statement_dump` calls return "Method not found" when
  directed at Asset Hub endpoints (`asset-hub-paseo.dotters.network`, `sys.ibp.network/asset-hub-paseo`).
  Frontend showed "Statement Store error: Method not found" on fulfill and Share-with-Doctor flows.
- **Root cause**: Asset Hub does not enable `--enable-statement-store`. On Paseo testnet the
  Statement Store is exposed only by the **People chain** node at
  `wss://paseo-people-next-rpc.polkadot.io`. The Nova Wallet SDK constant
  `SS_PASEO_STABLE_STAGE_ENDPOINTS` (from `@novasamatech/host-papp`) points at this endpoint.
- **Workaround**: Added `STATEMENT_STORE_TESTNET_WS_URL = "wss://paseo-people-next-rpc.polkadot.io"`
  in `web/src/config/network.ts`. Added `resolveStatementStoreUrl(wsUrl)` in
  `web/src/hooks/useStatementStore.ts` that maps any non-local Asset Hub URL to the People
  chain URL. Callers continue to pass the Asset Hub wsUrl; the resolver handles the redirect
  transparently for all raw-RPC calls (`_rawCheckRpc`, `_rawSubmit`, `_rawFetch`).
- **Status**: Resolved
- **Notes**: Local dev is unaffected — the local Substrate node runs both pallets on the same
  port so `ws://localhost:9944` is correct for both Asset Hub and Statement Store calls.

---

## IPFS

_No issues logged yet._

---

## PAPI

_No issues logged yet._

---

## Other

_No issues logged yet._
