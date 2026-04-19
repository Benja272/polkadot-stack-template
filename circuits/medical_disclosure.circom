pragma circom 2.1.6;

include "eddsaposeidon.circom";
include "poseidon.circom";
include "babyjub.circom";
include "ecdh.circom";

// Phase 5.1: full-record in-circuit encryption.
//
// The circuit proves all three ZKCP binding properties simultaneously:
//   P1 plaintext binding:  Poseidon(plaintext) == recordCommit
//                          EdDSA(medicPk, recordCommit) valid
//   P2 key↔ciphertext:     ciphertext[i] == plaintext[i] + Poseidon(shared, nonce, i)
//                          shared = ECDH(ephemeralSk, pkBuyer)
//   P3 ciphertext binding: Poseidon(ciphertext) == ciphertextHash
//
// The researcher fetches ciphertext bytes from the Statement Store (keyed
// by ciphertextHash), recomputes Poseidon to verify the match, then
// subtracts the ECDH-derived pads to recover plaintext. The 32 field
// elements decode back to the original canonicalised record.

template HashChain32() {
    signal input inputs[32];
    signal output out;

    component h1 = Poseidon(16);
    component h2 = Poseidon(16);
    component root = Poseidon(2);

    for (var i = 0; i < 16; i++) {
        h1.inputs[i] <== inputs[i];
        h2.inputs[i] <== inputs[i + 16];
    }
    root.inputs[0] <== h1.out;
    root.inputs[1] <== h2.out;
    out <== root.out;
}

template MedicalDisclosure(N) {
    // ---- Private inputs ----
    signal input plaintext[N];
    signal input sigR8x;
    signal input sigR8y;
    signal input sigS;
    signal input ephemeralSk;

    // ---- Public inputs (pubSignals layout) ----
    signal input recordCommit;    // [0]  listing
    signal input medicPkX;        // [1]  signed package
    signal input medicPkY;        // [2]
    signal input pkBuyerX;        // [3]  order
    signal input pkBuyerY;        // [4]
    signal input ephemeralPkX;    // [5]  derived from ephemeralSk
    signal input ephemeralPkY;    // [6]
    signal input ciphertextHash;  // [7]  Statement Store lookup key
    signal input nonce;           // [8]  must equal orderId

    // ---- P1: plaintext commits to medic's signed record ----
    component plaintextHash = HashChain32();
    for (var i = 0; i < N; i++) {
        plaintextHash.inputs[i] <== plaintext[i];
    }
    recordCommit === plaintextHash.out;

    component eddsa = EdDSAPoseidonVerifier();
    eddsa.enabled <== 1;
    eddsa.Ax <== medicPkX;
    eddsa.Ay <== medicPkY;
    eddsa.R8x <== sigR8x;
    eddsa.R8y <== sigR8y;
    eddsa.S <== sigS;
    eddsa.M <== recordCommit;

    // ---- Derive ephemeral pk = ephemeralSk · G ----
    component ephPk = BabyPbk();
    ephPk.in <== ephemeralSk;
    ephPk.Ax === ephemeralPkX;
    ephPk.Ay === ephemeralPkY;

    // ---- ECDH shared secret = ephemeralSk · pkBuyer ----
    component ecdh = Ecdh();
    ecdh.privateKey <== ephemeralSk;
    ecdh.publicKey[0] <== pkBuyerX;
    ecdh.publicKey[1] <== pkBuyerY;

    // ---- P2: per-element stream cipher bound to ECDH key ----
    // ciphertext[i] is a private witness; the circuit constrains its value
    // to plaintext[i] + Poseidon(sharedX, sharedY, nonce, i). Since
    // Poseidon with a unique (shared, nonce, i) triple is indistinguishable
    // from random, this is a one-time pad. ephemeralSk is fresh per proof
    // so (shared, nonce) is never reused.
    signal ciphertext[N];
    component pad[N];
    for (var i = 0; i < N; i++) {
        pad[i] = Poseidon(4);
        pad[i].inputs[0] <== ecdh.sharedKey[0];
        pad[i].inputs[1] <== ecdh.sharedKey[1];
        pad[i].inputs[2] <== nonce;
        pad[i].inputs[3] <== i;
        ciphertext[i] <== plaintext[i] + pad[i].out;
    }

    // ---- P3: ciphertextHash commits to the exact bytes the researcher fetches
    // from the Statement Store (off-chain blob keyed by this hash). ----
    component ciphertextHasher = HashChain32();
    for (var i = 0; i < N; i++) {
        ciphertextHasher.inputs[i] <== ciphertext[i];
    }
    ciphertextHash === ciphertextHasher.out;
}

component main { public [
    recordCommit,
    medicPkX, medicPkY,
    pkBuyerX, pkBuyerY,
    ephemeralPkX, ephemeralPkY,
    ciphertextHash,
    nonce
] } = MedicalDisclosure(32);
