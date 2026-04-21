# Protocol Flows

End-to-end technical flows for every process in the protocol.
Each flow shows who does what, where it happens (on-chain / off-chain / client), and what data moves.

> **Phase status**: Flows 2, 3, 4, 5 reflect **Phase 5.2 (current deployed state)** — no ZK
> proof, no Semaphore, Statement Store instead of IPFS. Flows 1 and 6 describe the
> **Phase 2/7 planned** Mixer Box + Semaphore architecture, not yet implemented.

---

## Flow 1: Medic Onboarding (Phase 2/7 — Planned, not yet implemented)

**Actors**: Medic, Central Authority (Mixer Box backend), People Chain, Asset Hub

```
MEDIC (browser)                  MIXER BOX (backend)         PEOPLE CHAIN    ASSET HUB
      |                                  |                         |               |
      | 1. Register identity             |                         |               |
      |----------------------------------------setIdentity()------>|               |
      |   (name, license number)         |                         |               |
      |                                  |                         |               |
      |  [Authority verifies off-chain: checks license database]   |               |
      |                                  |                         |               |
      | 2. Authority issues judgement    |                         |               |
      |<------------------------------------------KnownGood--------|               |
      |                                  |                         |               |
      | 3. Generate Semaphore identity locally                     |               |
      |   trapdoor + nullifier → commitment                        |               |
      |   (private keys never leave device)                        |               |
      |                                  |                         |               |
      | 4. Sign commitment               |                         |               |
      |   msg = "Registering commitment [X]"                       |               |
      |   signed with People Chain wallet                          |               |
      |                                  |                         |               |
      | 5. Submit to Mixer Box           |                         |               |
      |---(signature + commitment)------>|                         |               |
      |                                  |                         |               |
      |                   6. Verify signature                      |               |
      |                   7. Query KnownGood --------query-------->|               |
      |                                  |<-------confirmed--------|               |
      |                                  |                         |               |
      |                   8. Add to group|                         |               |
      |                                  |-----addMember(commitment)-------------->|
      |                                  |   (from Authority admin account)        |
      |                                  |                         |               |
      | 9. Onboarding complete           |                         |               |
```

**What ends up on-chain (Asset Hub)**: An anonymous Semaphore commitment, added by the Authority
account. No link to the medic's wallet or real identity.

**What the Mixer Box stores privately**: `{ people_chain_address → commitment }` — needed for
revocation. Never published.

---

## Flow 2: Record Listing (Phase 5.2 — Current)

**Actors**: Medic, Patient, Asset Hub

```
MEDIC (browser)                          PATIENT (browser)              ASSET HUB
      |                                        |                             |
      | 1. Upload JSON record                  |                             |
      |                                        |                             |
      | 2. Encode to 32 field elements         |                             |
      |    encodeRecordToFieldElements()        |                             |
      |    → plaintext[32]                     |                             |
      |                                        |                             |
      | 3. Compute recordCommit                |                             |
      |    HashChain32(plaintext[32])          |                             |
      |    = poseidon2(poseidon16(first16),    |                             |
      |                poseidon16(last16))     |                             |
      |                                        |                             |
      | 4. Sign recordCommit                   |                             |
      |    EdDSA-Poseidon(medicSk,             |                             |
      |      recordCommit) → { R8x, R8y, S }  |                             |
      |    medicPk = derivePublicKey(medicSk)  |                             |
      |                                        |                             |
      | 5. Export signed package               |                             |
      |----(plaintext[32], recordCommit, ----→ |                             |
      |     medicPk, sig, title)               |                             |
      |                                        |                             |
      |             6. Import + save to localStorage / Host KV               |
      |                (key: "signed-pkg:<recordCommit>")                    |
      |                                        |                             |
      |             7. createListing           |                             |
      |                (recordCommit,          |                             |
      |                 medicPkX, medicPkY,    |                             |
      |                 sigR8x, sigR8y, sigS,  |                             |
      |                 title, price) ---------+------------------------→   |
      |                                        |                             |
      |             Listing is live.           |                             |
```

**What ends up on-chain**: `recordCommit`, `medicPkX`, `medicPkY`, `sigR8x`, `sigR8y`, `sigS`,
`title`, `price`, `patient`, `active=true`. The full medic signature is public — researchers
can pre-verify "a known medic signed this" before placing a buy order.

**What stays off-chain**: `plaintext[32]` — stored in the patient's browser (localStorage or
Host KV). Required at fulfill time to encrypt the record for the buyer.

---

## Flow 3: Buy Order Placement

**Actors**: Researcher, Asset Hub

```
RESEARCHER (browser)                                              ASSET HUB
      |                                                               |
      | 1. Browse listings                                            |
      |-------------------getListings(criteria)---------------------->|
      |<------------------[list of listings with merkleRoot, price]--|
      |                                                               |
      | 2. Generate BabyJubJub keypair (if not already done)         |
      |   (pk_buyer, sk_buyer) — sk_buyer stays in browser           |
      |                                                               |
      | 3. Place buy order                                            |
      |-------------------placeBuyOrder(----------------------------->|
      |                       listingId,                              |
      |                       pkBuyerX, pkBuyerY, ← committed on-chain|
      |                   ) payable  ← native PAS locked in contract  |
      |                                                               |
      | Order is on-chain. Funds locked. pkBuyer is public.          |
```

**What ends up on-chain**: `listingId`, `pkBuyerX`, `pkBuyerY`, `amount` (native PAS), `confirmed=false`.

**Why `pkBuyer` must be on-chain before the patient acts**: The patient reads `pkBuyer` from
the order and uses it as the ECDH target for the Poseidon stream cipher encryption. The
ciphertext is locked to this specific public key — only the holder of `skBuyer` can decrypt.

---

## Flow 4: Record Sale (Phase 5.2 — Off-chain Verification)

**Actors**: Patient, Researcher, Statement Store, Asset Hub

> Phase 5.2 relaxes atomicity: no Groth16 proof is generated or verified on-chain. Payment
> releases when the patient calls `fulfill()`; the buyer verifies correctness off-chain after
> decrypting. Phase 5.3 will add a reclaim window for buyers who detect a bad ciphertext.
> The full ZKCP (atomic proof + designated-encryption) is Phase 5+ — see `ARCHITECTURE.md`.

**PATIENT — encrypt and fulfill:**
```
PATIENT (browser)                              STATEMENT STORE    ASSET HUB
      |                                               |                 |
      | 1. Read buy order                             |                 |
      |---getOrder(orderId) / getPendingOrderId()-----+--------------→ |
      |←-(listingId, pkBuyerX, pkBuyerY, amount)------+----------------|
      |                                               |                 |
      | 2. Load signed package from local storage     |                 |
      |    plaintext[32], recordCommit, medicPk, sig  |                 |
      |    (stored as "signed-pkg:<recordCommit>")    |                 |
      |                                               |                 |
      | 3. ECDH + Poseidon stream cipher (off-chain)  |                 |
      |    ephSk       ← random BabyJubJub scalar     |                 |
      |    ephPk       ← mulPointEscalar(Base8, ephSk)|                 |
      |    sharedPt    ← mulPointEscalar(pkBuyer, ephSk)               |
      |    ct[i]       ← (pt[i] + poseidon4([shX, shY, nonce, i]))     |
      |                    % BN254_R                  |                 |
      |    ctHash      ← HashChain32(ct[32])          |                 |
      |                                               |                 |
      | 4. Upload ciphertext to Statement Store       |                 |
      |---(ct[32] as 32×32 bytes) ----------------->  |                 |
      |                                               |                 |
      | 5. fulfill(orderId, ephPkX, ephPkY, ctHash)---+--------------→ |
      |    Contract: releases listing.price to patient|                 |
      |             refunds excess to researcher      |                 |
      |             emits SaleFulfilled(orderId,      |                 |
      |               listingId, patient, researcher, |                 |
      |               ephPkX, ephPkY, ctHash)         |                 |
```

**RESEARCHER — fetch, decrypt, verify:**
```
RESEARCHER (browser)                           STATEMENT STORE    ASSET HUB
      |                                               |                 |
      | 1. Observe SaleFulfilled or poll              |                 |
      |    getFulfillment(orderId) -------------------+--------------→ |
      |←-(ephPkX, ephPkY, ciphertextHash) ------------+----------------|
      |                                               |                 |
      | 2. Fetch ciphertext from Statement Store      |                 |
      |---(ciphertextHash as lookup key) ----------→  |                 |
      |←-(ciphertext bytes 32×32) ------------------- |                 |
      |                                               |                 |
      | 3. Decrypt                                    |                 |
      |    sharedPt  ← mulPointEscalar(ephPk, skBuyer)|                 |
      |    pt[i]     ← (ct[i] - poseidon4([shX, shY, nonce, i])        |
      |                  + BN254_R) % BN254_R         |                 |
      |    record    ← decodeRecordFromFieldElements(pt)                |
      |                                               |                 |
      | 4. Off-chain verification                     |                 |
      |    ✓ HashChain32(pt) == listing.recordCommit ?|                 |
      |    ✓ EdDSA.verify(medicPk, sig, recordCommit)?|                 |
      |    (shown as ✓/✗ chips in ResearcherBuy.tsx)  |                 |
```

**What the researcher receives**: Decrypted `plaintext[32]`, decoded to a JSON record via
`decodeRecordFromFieldElements()` in `web/src/utils/zk.ts`. Plus two off-chain verification
results (commitment match + medic signature).

**What no one else can read**: The ciphertext requires `skBuyer` for ECDH decryption. Only
the holder of `skBuyer` can reconstruct the shared point and peel off the Poseidon pad.

---

## Flow 5: Patient Accesses Their Own Data (Phase 5.2 — Current)

**Actors**: Patient, Asset Hub

```
PATIENT (browser)                                                 ASSET HUB
      |                                                               |
      | 1. Load own listings                                          |
      |---getListingCount() + getListing(i) for each i -----------→  |
      |←-[Listing{recordCommit, medicPk, sig, title, price, active}]--|
      |   (filter: listing.patient == own address)                    |
      |                                                               |
      | 2. Read own plaintext                                         |
      |   Load signed package from localStorage / Host KV            |
      |   (key: "signed-pkg:<recordCommit>")                         |
      |   → plaintext[32] + fieldsPreview already in the package     |
      |   No on-chain or network fetch needed                         |
      |                                                               |
      | 3. Load sale history                                          |
      |---getOrderCount() + getOrder(i) + getFulfillment(i) ------→  |
      |←-[Order + Fulfillment structs for fulfilled listings] --------|
      |                                                               |
      | Dashboard shows:                                              |
      |   - Active listings (title, price, recordCommit)             |
      |   - Fulfilled sales: researcher ephPk + ciphertextHash       |
      |   - Patient can re-read own plaintext from local storage      |
      |   - Total earnings from fulfilled orders                      |
```

**Key property**: The patient's signed package is never transferred or consumed by a sale.
Selling creates a buyer-specific ciphertext; the patient's local storage is unaffected.
The patient can always re-read their own records as long as the signed package file is in
their browser storage.

**Cross-device note**: The signed package lives in browser-local storage. If the patient
moves to a new device, they must re-import the signed package JSON. Phase 6 follow-up
(see `IMPLEMENTATION_PLAN.md`) discusses routing key storage through the Polkadot Host KV
API to survive IPFS CID redeploys on the same device.

---

## Flow 6: Medic Revocation (Phase 2/7 — Planned, not yet implemented)

**Actors**: Central Authority, People Chain, Mixer Box, Asset Hub

```
AUTHORITY (admin)           MIXER BOX (backend)       PEOPLE CHAIN    ASSET HUB
      |                            |                        |               |
      | 1. Revoke judgement        |                        |               |
      |--------revokeJudgement(medic_address)-------------->|               |
      |                            |                        |               |
      | 2. Trigger revocation      |                        |               |
      |--------notify(medic_address)-->|                    |               |
      |                            |                        |               |
      |             3. Look up commitment                   |               |
      |             private_map[medic_address] → commitment |               |
      |                            |                        |               |
      |             4. Remove from group                    |               |
      |                            |------removeMember(commitment)-------->|
      |                            |          (from Authority admin acct)  |
      |                            |                        |               |
      | Revocation complete.       |                        |               |
```

**What this does**: The medic's Semaphore commitment is removed from the group. Future proofs
using their Semaphore identity will fail the group membership check.

**What this does not do**: Invalidate past sales. Records already sold with this medic's
attestation remain valid — the nullifier was consumed and the ciphertext already emitted.
Revocation is forward-only.

**Risk**: If a medic's Semaphore key is compromised *before* revocation, they could generate
fraudulent attestations in the window between compromise and revocation. Mitigation: the
Mixer Box should support emergency revocation (fast path, no timelock).

---

## Summary: What Lives Where

### Phase 5.2 (current)

| Data | Location | Who can read it |
|---|---|---|
| `recordCommit` (Poseidon hash of plaintext[32]) | Asset Hub — Listing struct (public) | Anyone |
| `medicPkX/Y` + EdDSA signature | Asset Hub — Listing struct (public) | Anyone — researcher pre-verifies before paying |
| `pkBuyerX/Y` | Asset Hub — Order struct (public) | Anyone — pseudonymous |
| `ephPk` + `ciphertextHash` | Asset Hub — Fulfillment struct (public) | Anyone — ciphertext still needs `skBuyer` to decrypt |
| Ciphertext bytes | Statement Store (off-chain) | Anyone who knows the hash — but encrypted |
| Plaintext record | Patient's browser (localStorage / Host KV) | Patient only |
| Buyer private key `skBuyer` | Researcher's browser | Researcher only |
| Sale history | Asset Hub events (`SaleFulfilled`) | Anyone — buyer/patient addresses visible |

### Phase 3+ (planned — adds ZK, Semaphore, IPFS)

| Data | Location | Who can read it |
|---|---|---|
| Medic real identity | People Chain (public) | Anyone |
| Semaphore commitment | Asset Hub contract (public) | Anyone — but not linkable to medic |
| `{address → commitment}` map | Mixer Box (private) | Authority only |
| Encrypted record blob | IPFS | Anyone with CID — but encrypted |
| Merkle root | Asset Hub contract (public) | Anyone — reveals nothing about field values |
| EdDSA signature | Off-chain (patient device) | Patient only — private input to circuit |
| Ciphertext (post-sale) | Asset Hub event log (public) | Buyer only (has `sk_buyer`) |
