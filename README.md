# Medical Data Marketplace

Patients sell medic-signed health records to researchers without revealing plaintext to anyone except the paying buyer.

**Backend**: Solidity on PVM (pallet-revive, Asset Hub)  
**Frontend**: React + TypeScript (PAPI + viem)  
**Live**: https://own-your-medical-records42.dot.li

---

## How It Works

1. **Medic signs** — Poseidon-hashes the record (header + body + PII compartments), signs the commitment with EdDSA over BabyJubJub.
2. **Patient lists** — publishes commitment + medic signature on-chain, sets a PAS price. No plaintext touches the chain.
3. **Researcher buys** — locks PAS and registers their BabyJubJub public key for ECDH.
4. **Patient fulfills** — encrypts the record in the browser (BabyJubJub ECDH + Poseidon stream cipher), uploads ciphertext to the Statement Store, calls `fulfill()` to release escrow.
5. **Researcher verifies** — decrypts, then checks off-chain: Poseidon hash of plaintext matches on-chain commitment, medic EdDSA signature is valid.

---

## Paseo Contracts

| Contract       | Address                                      |
| -------------- | -------------------------------------------- |
| MedicalMarket  | `0xf9bdefc23b6dc2a71a8a97d43ebb45e0c86a1ef9` |
| MedicAuthority | `0x0c21366490d98141f04c00c31456aca803db758f` |

Statement Store lives on People Chain (`wss://paseo-people-next-rpc.polkadot.io`) — Asset Hub Paseo collator does not expose `statement_submit`; the hook resolves this automatically.

Frontend deploys to Bulletin Chain / DotNS automatically on push to `master` via `.github/workflows/deploy-frontend.yml`.

---

## Run Locally

Requires Node.js 22.x and Rust stable.

```bash
./scripts/download-sdk-binaries.sh   # fetch polkadot-omni-node, eth-rpc, zombienet
./scripts/start-all.sh               # relay + parachain + contracts + frontend
```

Frontend at http://127.0.0.1:5173. Bootstraps Alice/Bob/Charlie with PAS, deploys contracts, registers Alice as a verified medic.

Demo flow: **Medic Sign** (Alice) → **Patient Dashboard** (Bob, list + fulfill) → **Researcher Buy** (Charlie, buy + decrypt).

Deploy contracts to Paseo:

```bash
cd contracts/pvm && npx hardhat vars set PRIVATE_KEY
./scripts/deploy-paseo.sh
```

---

## What Works

- Full end-to-end flow locally and on Paseo
- Off-chain BabyJubJub ECDH + Poseidon encryption entirely in the browser
- Three-compartment Poseidon commitments (header / body / PII separated)
- Statement Store integration on People Chain
- 2-of-3 pallet-multisig governance for MedicAuthority
- Nova Wallet / Spektr mobile support

## Known Gaps

**Relaxed atomicity**: a patient could `fulfill()` with a garbage ciphertext and collect payment. The researcher detects the mismatch after decryption but has no on-chain reclaim path yet (Phase 5.3).

**ZK dropped from on-chain verification**: Phase 5.1 built a complete Groth16 circuit (`circuits/`) binding record content, medic signature, and ECDH — but BN254 pairing on PVM hit ~800M gas weight on Paseo. Phase 5.2 moved verification off-chain. See `docs/product/ZKCP_DESIGN_OPTIONS.md`.

**No on-chain physician identity**: medic registry is a multisig-owned contract, not People Chain identity + Semaphore (Phase 6).

---

## Versions

|              |                                         |
| ------------ | --------------------------------------- |
| polkadot-sdk | stable2512-3 / pallet-revive 0.12.2     |
| Solidity     | 0.8.28 / resolc 1.0.0                   |
| PAPI         | 1.23.3 / viem 2.x                       |
| @zk-kit      | baby-jubjub 1.0.3, eddsa-poseidon 1.1.0 |
| Node.js      | 22.x LTS                                |
