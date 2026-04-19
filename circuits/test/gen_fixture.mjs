// Regenerate contracts/pvm/test/fixtures/phase5_1_proof.json after any circuit or
// zkey change. Produces a deterministic-ish fixture (fixed scalars) so hardhat
// tests reproduce the same proof across runs.
//
// Run:  cd circuits && node test/gen_fixture.mjs

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import * as snarkjs from "snarkjs";
import { poseidon2, poseidon4, poseidon16 } from "poseidon-lite";
import { mulPointEscalar, Base8, order as jubOrder } from "@zk-kit/baby-jubjub";

const require = createRequire(import.meta.url);
const { signMessage, derivePublicKey } = require("@zk-kit/eddsa-poseidon");

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM = join(__dirname, "../build/medical_disclosure_js/medical_disclosure.wasm");
const ZKEY = join(__dirname, "../build/medical_disclosure_final.zkey");
const OUT = join(__dirname, "../../contracts/pvm/test/fixtures/phase5_1_proof.json");

const BN254_R = BigInt(
	"21888242871839275222246405745257275088548364400416034343698204186575808495617",
);
const N = 32;
const SUB_ORDER = jubOrder >> 3n;
const BYTES_PER_SLOT = 31;
const MAX_PAYLOAD_BYTES = (N - 1) * BYTES_PER_SLOT;
const RS = 0x1e;
const US = 0x1f;

function bytesToBigint(b) {
	let n = 0n;
	for (const x of b) n = (n << 8n) | BigInt(x);
	return n;
}

function encodeRecord(fields) {
	const keys = Object.keys(fields).sort();
	const enc = new TextEncoder();
	const parts = [];
	for (const k of keys) {
		parts.push(enc.encode(k));
		parts.push(new Uint8Array([US]));
		parts.push(enc.encode(String(fields[k])));
		parts.push(new Uint8Array([RS]));
	}
	const totalLen = parts.reduce((s, p) => s + p.length, 0);
	if (totalLen > MAX_PAYLOAD_BYTES) throw new Error(`record too large: ${totalLen}`);
	const bytes = new Uint8Array(totalLen);
	let o = 0;
	for (const p of parts) {
		bytes.set(p, o);
		o += p.length;
	}
	const plaintext = new Array(N).fill(0n);
	plaintext[0] = BigInt(totalLen);
	for (let i = 0; i < N - 1; i++) {
		const s = i * BYTES_PER_SLOT;
		if (s >= totalLen) break;
		plaintext[i + 1] = bytesToBigint(bytes.subarray(s, Math.min(s + BYTES_PER_SLOT, totalLen)));
	}
	return plaintext;
}

function hashChain32(inputs) {
	const h1 = poseidon16(inputs.slice(0, 16));
	const h2 = poseidon16(inputs.slice(16, 32));
	return poseidon2([h1, h2]);
}

// Fixed scalars so the fixture reproduces.
const MEDIC_PRIV = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133";
const SK_BUYER = 1234567890123456789n % SUB_ORDER;
const EPH_SK = 9876543210987654321n % SUB_ORDER;
const ORDER_ID = 0n;

const FIELDS = { name: "Alice", age: "34", condition: "diabetes" };

const plaintext = encodeRecord(FIELDS);
const recordCommit = hashChain32(plaintext);
const sig = signMessage(MEDIC_PRIV, recordCommit);
const medicPk = derivePublicKey(MEDIC_PRIV);
const pkBuyer = mulPointEscalar(Base8, SK_BUYER);
const ephPk = mulPointEscalar(Base8, EPH_SK);
const shared = mulPointEscalar(pkBuyer, EPH_SK);
const ciphertext = plaintext.map(
	(p, i) => (p + poseidon4([shared[0], shared[1], ORDER_ID, BigInt(i)])) % BN254_R,
);
const ciphertextHash = hashChain32(ciphertext);

const input = {
	plaintext,
	sigR8x: sig.R8[0],
	sigR8y: sig.R8[1],
	sigS: sig.S,
	ephemeralSk: EPH_SK,
	recordCommit,
	medicPkX: medicPk[0],
	medicPkY: medicPk[1],
	pkBuyerX: pkBuyer[0],
	pkBuyerY: pkBuyer[1],
	ephemeralPkX: ephPk[0],
	ephemeralPkY: ephPk[1],
	ciphertextHash,
	nonce: ORDER_ID,
};

console.log("Generating fixture proof…");
const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
console.log("Done.");

const toHex = (x) => "0x" + BigInt(x).toString(16).padStart(64, "0");
const fixture = {
	// listing input
	recordCommit: recordCommit.toString(),
	// order input
	pkBuyerX: pkBuyer[0].toString(),
	pkBuyerY: pkBuyer[1].toString(),
	orderId: Number(ORDER_ID),
	// proof — note the G2 point ordering swap (snarkjs emits (real, imag); pairing precompile wants (imag, real))
	a: [toHex(proof.pi_a[0]), toHex(proof.pi_a[1])],
	b: [
		[toHex(proof.pi_b[0][1]), toHex(proof.pi_b[0][0])],
		[toHex(proof.pi_b[1][1]), toHex(proof.pi_b[1][0])],
	],
	c: [toHex(proof.pi_c[0]), toHex(proof.pi_c[1])],
	pubSignals: publicSignals.map((s) => BigInt(s).toString()),
	// decryption companions for researcher-side unit tests
	skBuyer: SK_BUYER.toString(),
	ciphertext: ciphertext.map((c) => c.toString()),
	expectedRecord: FIELDS,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(fixture, null, 2) + "\n");
console.log(`Wrote ${OUT}`);
