# Architecture

## Overview: Two-Chain Design

All execution and settlement lives on Asset Hub. People Chain handles professional identity
asynchronously via an off-chain Authority backend. No Bulletin Chain, no XCM synchronous reads,
no BBS+ pairing operations.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         PEOPLE CHAIN                                 │
│  Identity Pallet                                                     │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  Medic on-chain identity (name, medical license ID)            │  │
│  │  Central Authority = on-chain Registrar                        │  │
│  │  Judgement: "Known Good" issued per verified medic             │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ off-chain query
                       │ (async — no XCM precompile needed)
┌──────────────────────▼───────────────────────────────────────────────┐
│                    MIXER BOX (Authority Backend)                     │
│  Off-chain Node.js service                                           │
│  1. Medic submits: Semaphore commitment + People Chain signature     │
│  2. Backend verifies: KnownGood judgement on People Chain            │
│  3. Backend calls: addMember(commitment) on Asset Hub (admin key)    │
│  4. Maintains private: {address → commitment} for revocation         │
│                                                                      │
│  Result: on-chain, only the Authority account added a commitment.    │
│  No transaction links medic wallet to Semaphore commitment.          │
└──────────────────────┬───────────────────────────────────────────────┘
                       │ contract calls
┌──────────────────────▼───────────────────────────────────────────────┐
│                         ASSET HUB                                    │
│  pallet-revive · Solidity → resolc → PVM (RISC-V)                   │
│                                                                      │
│  ┌─────────────────────┐  ┌──────────────────────────────────────┐   │
│  │  Semaphore Group    │  │  MedicalMarket.sol                   │   │
│  │  addMember()        │  │  placeBuyOrder(criteria, price,      │   │
│  │  removeMember()     │  │               pk_buyer)              │   │
│  │  verifyProof()      │  │  fulfill(proof, ciphertext,          │   │
│  └─────────────────────┘  │           nullifier, ipfs_cid)      │   │
│                           │  → verify proof                      │   │
│  ┌─────────────────────┐  │  → release USDT/USDC to patient     │   │
│  │  ZK Verifier        │  │  → emit ciphertext + CID to buyer   │   │
│  │  (Groth16, via      │  └──────────────────────────────────────┘   │
│  │   resolc to PVM)    │                                             │
│  └─────────────────────┘  Contract state anchors:                   │
│                           - Blake2b/Poseidon hash of encrypted blob  │
│                           - IPFS CID                                 │
│                           - Buyer's PK_buyer (BabyJubJub)           │
└──────────────────────────────────────────────────────────────────────┘
                       │ read CID after purchase
                       ▼
                     IPFS
              (patient-maintained pin)
```

> **The diagram above is the Phase 3+ target architecture** (Semaphore Group, ZK Verifier,
> IPFS). See [Current State (Phase 5.2)](#current-state-phase-52) below for what is deployed today.

---

## Current State: Phase 5.2

Phase 5.2 is the deployed runtime as of 2026-04. **No on-chain ZK proof, no Semaphore Group,
no IPFS.** The contract is a pure escrow + signal layer; atomicity is relaxed (Phase 5.3 will
add a reclaim window). The archived circuit + verifier live in `circuits/` and
`contracts/pvm/contracts/Verifier.sol`; see `docs/product/ZKCP_DESIGN_OPTIONS.md` for the
decision record.

**Deployed** (addresses in `deployments.json`): `MedicalMarket.sol` Phase 5.2, `medicAuthority`,
2-of-3 pallet-multisig (threshold=2, signatories: Bob, Charlie, Alice; `map_account` registered).

### Phase 5.2 Structs and Events

```solidity
struct Listing {
    uint256 recordCommit;  // HashChain32(plaintext[32]) — what the medic signed
    uint256 medicPkX;      // medic's BabyJubJub pubkey (EdDSA-Poseidon)
    uint256 medicPkY;
    uint256 sigR8x;        // medic's EdDSA signature over recordCommit
    uint256 sigR8y;
    uint256 sigS;
    string  title;
    uint256 price;         // minimum in wei (native PAS)
    address patient;
    bool    active;
}

struct Order {
    uint256 listingId;
    address researcher;
    uint256 amount;        // native PAS locked
    bool    confirmed;
    bool    cancelled;
    uint256 pkBuyerX;      // researcher's BabyJubJub pubkey for ECDH
    uint256 pkBuyerY;
}

struct Fulfillment {
    uint256 ephPkX;         // patient's ephemeral BabyJubJub pubkey
    uint256 ephPkY;
    uint256 ciphertextHash; // Statement Store key = HashChain32(ciphertext[32])
}
```

```solidity
event ListingCreated(address indexed patient, uint256 indexed listingId,
    uint256 recordCommit, uint256 medicPkX, uint256 medicPkY, string title, uint256 price);
event OrderPlaced(uint256 indexed listingId, uint256 indexed orderId,
    address indexed researcher, uint256 amount, uint256 pkBuyerX, uint256 pkBuyerY);
event SaleFulfilled(uint256 indexed orderId, uint256 indexed listingId,
    address patient, address researcher,
    uint256 ephPkX, uint256 ephPkY, uint256 ciphertextHash);
```

### Phase 5.2 Contract Interface

```solidity
// Patient: publish listing. Medic sig stored on-chain; researcher can pre-verify before paying.
createListing(
    uint256 recordCommit,
    uint256 medicPkX, uint256 medicPkY,
    uint256 sigR8x,   uint256 sigR8y, uint256 sigS,
    string calldata title,
    uint256 price
)

// Researcher: lock native PAS + register BabyJubJub pubkey (must send ≥ listing.price).
placeBuyOrder(uint256 listingId, uint256 pkBuyerX, uint256 pkBuyerY) payable

// Patient: declare ephemeral key + ciphertext hash; releases listing.price to patient.
// No on-chain proof. Buyer verifies (HashChain32 == recordCommit, EdDSA sig) off-chain.
fulfill(uint256 orderId, uint256 ephPkX, uint256 ephPkY, uint256 ciphertextHash)

cancelListing(uint256 listingId)   // only if no pending order
cancelOrder(uint256 orderId)       // researcher refunded in full
```

### Phase 5.2 Off-Chain Verification (buyer)

After fetching ciphertext from the Statement Store and decrypting via ECDH + Poseidon stream cipher:
1. `HashChain32(plaintext) == listing.recordCommit` — proves the plaintext matches what was signed
2. `EdDSA.verify(listing.medicPk, listing.sig, listing.recordCommit)` — proves a known medic signed it

`HashChain32(x[32]) = poseidon2(poseidon16(x[0..16]), poseidon16(x[16..32]))` — see `web/src/utils/zk.ts`.
Both checks render as ✓/✗ chips in `ResearcherBuy.tsx`.

---

## Layer 1: People Chain (Professional Credentialing)

The Central Authority registers as an on-chain **Registrar** on the People Chain and issues
`KnownGood` judgements to verified medics after off-chain credential verification.

This replaces any custom registry contract. The People Chain identity system is battle-tested
and provides a globally recognizable professional credential.

**No synchronous XCM queries**: The identity check happens off-chain in the Mixer Box before
the medic is added to the Semaphore group. Once in the group, the marketplace contract verifies
credentials by checking the local Semaphore group root — a synchronous, cheap operation with
~500ms confirmation times.

---

## Layer 2: Mixer Box (Authority Backend)

An off-chain Node.js service that bridges asynchronous People Chain identity to synchronous
Asset Hub contract state.

**Blind Registration flow:**
1. Medic generates Semaphore identity locally (trapdoor + nullifier → commitment). Private
   keys never leave the device.
2. Medic signs: `"Registering Semaphore commitment [X]"` with their People Chain wallet.
3. Medic submits signature + commitment to Mixer Box via the frontend.
4. Mixer Box:
   - Verifies signature against the People Chain address.
   - Checks that address has `KnownGood` from the Authority registrar.
5. Mixer Box calls `addMember(commitment)` on the Semaphore contract **from the Authority
   admin account**. No on-chain link to the medic's wallet.

**Revocation flow:**
1. Authority revokes `KnownGood` on People Chain.
2. Mixer Box calls `removeMember(commitment)` using the private `{address → commitment}` mapping.
3. This mapping is the only link between identity and anonymity. Must never be published.

**Build estimate**: ~1–2 days. Express endpoint + polkadot.js query + contract call.

---

## Layer 3: Asset Hub (Execution and Settlement)

### Data Anchoring (Phase 3+ Planned)

> **Phase 5.2 (current)**: Ciphertext is uploaded to the **Statement Store** (`pallet-statement`),
> not IPFS. Only `ciphertextHash = HashChain32(ciphertext[32])` lands on-chain, in the
> `Fulfillment` struct. The researcher fetches the ciphertext from the Statement Store after
> observing `SaleFulfilled`. No `recordCommit` in the listing is a Merkle root — it is
> `HashChain32(plaintext[32])`.

When a record is listed in the full ZK architecture (Phase 3+), the patient stores two pieces
of data in the marketplace contract:

1. **Merkle root**: Poseidon Merkle root of the record's attribute tree.
2. **Data hash**: Hash of the complete encrypted blob for integrity checking.

The ZK proof binds the buyer's `PK_buyer` to the specific hash stored in the contract.

**Availability note**: Hash anchoring proves integrity but not availability. Phase 5.3 adds an
escrow/acknowledge/reclaim window so a buyer who gets a bad ciphertext can recover payment.
A bond-based IPFS availability mechanism is V2.

### Cryptographic Primitive Stack

| Component | Logic | Tooling | Audit status |
|---|---|---|---|
| Trust | Verify doctor's license | People Chain (async via Mixer Box) | — |
| Integrity | Merkle root signature | `@zk-kit/eddsa-poseidon` (BabyJubJub EdDSA) | Semaphore V4 audit (Mar 2024) |
| Commitment | JSON field tree | `@zk-kit/lean-imt` (Poseidon Merkle tree) | Production-used |
| Anonymity | Signer privacy | Semaphore v4 (built on zk-kit) | Semaphore V4 audit |
| Designated encryption | Buyer-specific ciphertext | `@zk-kit/poseidon-cipher` (ECDH + Poseidon) | Production-used |
| Escrow + atomic swap | Settlement | `MedicalMarket.sol` on PVM | — |
| Anchoring | Hash/CID storage | Asset Hub contract state | — |

**zk-kit** (`@privacy-scaling-explorations/zk-kit`) provides audited, browser-compatible implementations
of EdDSA, ECDH, Poseidon encryption, and Merkle trees — all in TypeScript with matching Circom
circuit packages. Semaphore v4 is built on it. Use it directly rather than custom implementations.

**POD** (`pod.org`, 0xPARC) provides General Purpose Circuits for selective disclosure and has
native Semaphore integration. However, it is explicitly experimental with no security audit.
Consider for V2 if you want pre-built configurable circuits. Skip for MVP.

### The ZK Circuit (Phase 3+ Planned — not in current runtime)

One Groth16 circuit (Circom) proves all of the following:

```
Private inputs:
  - All JSON record fields (leaves of the Merkle tree)
  - Merkle inclusion paths for the disclosed fields
  - Medic's EdDSA signature over the Merkle root
  - Patient's ephemeral BabyJubJub private key (for ECDH)
  - Semaphore identity (trapdoor, nullifier)

Public inputs:
  - Merkle root (matches the on-chain commitment)
  - Disclosed field values (what the researcher sees)
  - Semaphore group root (matches on-chain Semaphore state)
  - Semaphore nullifier hash (replay prevention)
  - Buyer's BabyJubJub public key PK_buyer
  - Poseidon ciphertext (encrypted disclosed fields)
  - External nullifier (ties proof to this specific buy order)

The circuit proves:
  1. Signature: The medic's EdDSA sig is valid over the Merkle root.
  2. Inclusion: The disclosed fields are leaves of that Merkle root.
  3. Anonymity: The signing medic is a member of the Semaphore group.
  4. Encryption: The ciphertext = PoseidonEncrypt(disclosed_fields,
                   ECDH(patient_ephemeral_key, PK_buyer))
```

Only the researcher holding the private key for `PK_buyer` can decrypt the ciphertext.

**Why this circuit is achievable in 2–3 days**: All four components use circomlib primitives
(`EdDSA`, `MerkleProof`, `Poseidon`, `Semaphore`). No BLS12-381 pairing operations.
No BBS+. Estimated constraint count: 200k–500k R1CS constraints — well within browser
proving limits.

### Patient Data Ownership Layer

Patients are data owners, not just sellers. The system must make this real in the UX.

**What the patient always retains:**

- The signed package JSON (stored in browser localStorage / Host KV as `signed-pkg:<hash>`),
  which contains `plaintext[32]` — the patient can re-read their own record at any time.
- The ability to read their own records in plaintext in the dashboard.

Note: in Phase 5.2 there is no IPFS blob. The patient's own plaintext lives entirely in
local browser storage. Selling creates a buyer-specific ciphertext; the patient's storage
is not affected.

**What the contract stores per listing (Phase 5.2 — queryable by the patient):**

```solidity
struct Listing {
    uint256 recordCommit;  // HashChain32(plaintext[32]) — what the medic signed
    uint256 medicPkX;      // medic's BabyJubJub pubkey (public)
    uint256 medicPkY;
    uint256 sigR8x;        // EdDSA signature over recordCommit (public)
    uint256 sigR8y;
    uint256 sigS;
    string  title;
    uint256 price;         // minimum in wei (native PAS)
    address patient;
    bool    active;
}
```

**What the contract emits on fulfillment (Phase 5.2):**

```solidity
event SaleFulfilled(
    uint256 indexed orderId,
    uint256 indexed listingId,
    address patient,
    address researcher,
    uint256 ephPkX,
    uint256 ephPkY,
    uint256 ciphertextHash  // Statement Store key; researcher fetches ciphertext by this hash
);
```

**Patient dashboard reads (Phase 5.2):**

1. All `Listing` structs where `listing.patient == own address` → active / sold listings.
2. `SaleFulfilled` events for those listing IDs → purchase history, earnings, buyer ephPk.
3. Plaintext is in local storage (`signed-pkg:<recordCommit>`) — no network fetch needed.

**Key ownership model**: Selling a record creates a ciphertext encrypted for `pkBuyer` using
ECDH + Poseidon stream cipher. The patient's signed package is never transferred. The buyer
can decrypt only the ciphertext produced for their `pkBuyer`; these are independent.

---

### Contract Interface (Phase 5.2 — current)

**Place buy order** (researcher):
```solidity
// Lock native PAS; register BabyJubJub pubkey for ECDH. Must send ≥ listing.price.
placeBuyOrder(
    uint256 listingId,    // which listing to buy
    uint256 pkBuyerX,     // researcher's BabyJubJub public key X coordinate
    uint256 pkBuyerY      // researcher's BabyJubJub public key Y coordinate
) payable
```
Researcher commits `pkBuyer` on-chain. Patient reads it from the order to derive the ECDH
shared secret and produce the buyer-specific ciphertext.

**Fulfill order** (patient):
```solidity
// Phase 5.2: no on-chain proof. Patient declares ephemeral key + ciphertext hash.
fulfill(
    uint256 orderId,
    uint256 ephPkX,         // patient's ephemeral BabyJubJub pubkey X
    uint256 ephPkY,         // patient's ephemeral BabyJubJub pubkey Y
    uint256 ciphertextHash  // HashChain32(ciphertext[32]); Statement Store lookup key
)
```
Contract:
1. Verifies caller is `listing.patient`.
2. Releases `listing.price` to patient; refunds excess to researcher.
3. Emits `SaleFulfilled`. No proof verification — buyer verifies off-chain.

> **Phase 3+ target**: `fulfill()` will also accept a Groth16 proof and Semaphore nullifier,
> verify them against the on-chain verifier, and check the Merkle root matches the listing.
> That makes the swap fully atomic (no off-chain trust required).

---

## Two-Week Sprint Plan (historical — completed 2026-04)

### Week 1: Identity and JSON-Merkle Logic

| Day | Work | Risk |
|---|---|---|
| 1–2 | Scaffold template. Deploy local Asset Hub. Mock People Chain registrar with a Node.js script. Verify `KnownGood` judgement flow end-to-end. | Low |
| 3–4 | Build Mixer Box: Express endpoint + People Chain judgement check + `addMember` call. Deploy Semaphore group contract on Asset Hub via resolc. Verify `addMember` + `verifyProof` on PVM. **First critical checkpoint.** | Medium |
| 5–7 | JSON-to-Merkle TypeScript utility. Medic signing tool: field → leaf → Merkle root → EdDSA signature with BabyJubJub. Unit tests for the Merkle construction. | Low–Medium |

### Week 2: Circuit and Marketplace

| Day | Work | Risk |
|---|---|---|
| 8–10 | Circom circuit: Merkle inclusion + EdDSA verification + Semaphore + ECDH + Poseidon encryption. Compile to `.wasm` + `.zkey`. **Measure constraint count before proceeding.** Compile Groth16 verifier to Solidity, then resolc to PVM. **Second critical checkpoint.** | High |
| 11–12 | `MedicalMarket.sol`: `placeBuyOrder`, `fulfill`, escrow, atomic swap. Integration test: full flow on local PVM node. | Medium |
| 13–14 | Frontend (v0 + PAPI + snarkjs): medic signing tool, patient listing + proving flow, researcher buy flow. End-to-end on Paseo testnet. | Medium |

### Critical checkpoints

| Checkpoint | Day | Pass condition | Fallback |
|---|---|---|---|
| PVM + Semaphore | 4 | `verifyProof` works on local Asset Hub with a test proof | Use pure Solidity verifier without PVM optimization for demo |
| Circuit constraint count | 8 | < 2M constraints for browser proving | Split into two sequential proofs verified by contract |
| End-to-end on Paseo | 13 | Full buy flow completes with test USDT | Demo on local node only |

---

## PVM Performance Advantage

The PVM's RISC-V architecture enables native-speed execution of cryptographic operations via
FFI calls to Rust-based verifiers. For the operations in this circuit:

| Operation | EVM cost | PVM cost (estimated) | Speedup |
|---|---|---|---|
| Groth16 pairing check | ~500k gas | ~40k gas | ~12x |
| Poseidon hash | ~700 gas/field | ~50 gas/field | ~14x |
| EdDSA verification | ~200k gas | ~15k gas | ~13x |

These estimates are directionally correct. Actual numbers require on-chain benchmarking.
The core point: ZK verification that is economically impractical on the EVM becomes
cheap enough for a real marketplace on PVM.

---

## Future: Homomorphic Research (V3)

Once individual record sales work, the system can support aggregate computation without
decryption using **Summa** (Parity's homomorphic encryption library for PVM). A researcher
could compute "average HbA1c across 1,000 patients" programmatically on encrypted on-chain
data with no individual record ever decrypted.

Out of scope for MVP. Requires no protocol changes — only additional circuit and contract work
on top of the existing encrypted storage model.
