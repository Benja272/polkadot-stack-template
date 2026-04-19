// Phase 5.1 round-trip test: encode → commit → sign → prove → verify → decrypt → decode.
// Verifies the JS encoding matches the circuit's Poseidon chain byte-for-byte and
// that the ECDH+stream-cipher delivery recovers the exact medic-signed record.
//
// Run:  cd circuits && node test/record_roundtrip.test.mjs

import { readFileSync } from "fs";
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
const VKEY = JSON.parse(readFileSync(join(__dirname, "../build/verification_key.json"), "utf8"));

const BN254_R = BigInt(
	"21888242871839275222246405745257275088548364400416034343698204186575808495617",
);
const N = 32;
const SUB_ORDER = jubOrder >> 3n;
const BYTES_PER_SLOT = 31;
const MAX_PAYLOAD_BYTES = (N - 1) * BYTES_PER_SLOT; // 961

const RS = 0x1e; // record separator
const US = 0x1f; // unit separator

// ---- Encoding / decoding ----

function bytesToBigint(bytes) {
	let n = 0n;
	for (const b of bytes) n = (n << 8n) | BigInt(b);
	return n;
}

function bigintToBytes(n, len) {
	const out = new Uint8Array(len);
	for (let i = len - 1; i >= 0; i--) {
		out[i] = Number(n & 0xffn);
		n >>= 8n;
	}
	return out;
}

export function encodeRecordToFieldElements(fields) {
	const keys = Object.keys(fields).sort();
	for (const k of keys) {
		if (k.includes("\x1f") || k.includes("\x1e")) throw new Error(`key "${k}" contains a reserved control byte`);
		const v = String(fields[k]);
		if (v.includes("\x1f") || v.includes("\x1e")) throw new Error(`value for "${k}" contains a reserved control byte`);
	}

	const enc = new TextEncoder();
	const parts = [];
	for (const k of keys) {
		parts.push(enc.encode(k));
		parts.push(new Uint8Array([US]));
		parts.push(enc.encode(String(fields[k])));
		parts.push(new Uint8Array([RS]));
	}
	const totalLen = parts.reduce((s, p) => s + p.length, 0);
	if (totalLen > MAX_PAYLOAD_BYTES) {
		throw new Error(`record too large: ${totalLen} bytes (max ${MAX_PAYLOAD_BYTES})`);
	}
	const bytes = new Uint8Array(totalLen);
	let o = 0;
	for (const p of parts) {
		bytes.set(p, o);
		o += p.length;
	}

	const plaintext = new Array(N).fill(0n);
	plaintext[0] = BigInt(totalLen);
	for (let i = 0; i < N - 1; i++) {
		const start = i * BYTES_PER_SLOT;
		if (start >= totalLen) break;
		const end = Math.min(start + BYTES_PER_SLOT, totalLen);
		plaintext[i + 1] = bytesToBigint(bytes.subarray(start, end));
	}
	return plaintext;
}

export function decodeRecordFromFieldElements(plaintext) {
	const totalLen = Number(plaintext[0]);
	if (totalLen < 0 || totalLen > MAX_PAYLOAD_BYTES) {
		throw new Error(`invalid length prefix: ${totalLen}`);
	}
	const bytes = new Uint8Array(totalLen);
	let remaining = totalLen;
	for (let i = 0; i < N - 1 && remaining > 0; i++) {
		const chunk = Math.min(BYTES_PER_SLOT, remaining);
		const slot = bigintToBytes(plaintext[i + 1], BYTES_PER_SLOT);
		bytes.set(slot.subarray(BYTES_PER_SLOT - chunk), i * BYTES_PER_SLOT);
		remaining -= chunk;
	}

	const dec = new TextDecoder("utf-8", { fatal: true });
	const fields = {};
	let start = 0;
	while (start < totalLen) {
		let end = start;
		while (end < totalLen && bytes[end] !== RS) end++;
		if (end === start) break;
		let us = start;
		while (us < end && bytes[us] !== US) us++;
		if (us === end) throw new Error("missing unit separator");
		const key = dec.decode(bytes.subarray(start, us));
		const value = dec.decode(bytes.subarray(us + 1, end));
		fields[key] = value;
		start = end + 1;
	}
	return fields;
}

// ---- Poseidon hashing that matches the circuit's HashChain32 ----

export function hashChain32(inputs) {
	if (inputs.length !== N) throw new Error(`expected ${N} inputs`);
	const h1 = poseidon16(inputs.slice(0, 16));
	const h2 = poseidon16(inputs.slice(16, 32));
	return poseidon2([h1, h2]);
}

// ---- Pad + encryption mirrors of the circuit ----

function pad(shared, nonce, idx) {
	return poseidon4([shared[0], shared[1], nonce, BigInt(idx)]);
}

function encrypt(plaintext, shared, nonce) {
	return plaintext.map((p, i) => (p + pad(shared, nonce, i)) % BN254_R);
}

function decrypt(ciphertext, shared, nonce) {
	return ciphertext.map((c, i) => (c - pad(shared, nonce, i) + BN254_R) % BN254_R);
}

// ---- Random scalar in the BabyJubJub subgroup ----

function randomScalar() {
	const buf = new Uint8Array(32);
	crypto.getRandomValues(buf);
	let n = 0n;
	for (const b of buf) n = (n << 8n) | BigInt(b);
	return n % SUB_ORDER;
}

function canonStringify(obj) {
	return JSON.stringify(Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))));
}

// ---- One end-to-end test case ----

async function runCase(label, fields, { skipProof = false } = {}) {
	console.log(`\n=== ${label} ===`);
	const plaintext = encodeRecordToFieldElements(fields);
	const recordCommit = hashChain32(plaintext);

	// Encode/decode round-trip must be exact.
	const decoded = decodeRecordFromFieldElements(plaintext);
	if (canonStringify(decoded) !== canonStringify(fields)) {
		console.error("encode/decode mismatch:", { expected: fields, got: decoded });
		process.exit(1);
	}
	console.log(`✓ encode/decode round-trip byte-exact (${Object.keys(fields).length} fields)`);

	if (skipProof) return;

	const medicPriv = "0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133";
	const sig = signMessage(medicPriv, recordCommit);
	const medicPk = derivePublicKey(medicPriv);

	const skBuyer = randomScalar();
	const pkBuyer = mulPointEscalar(Base8, skBuyer);

	const ephSk = randomScalar();
	const ephPk = mulPointEscalar(Base8, ephSk);
	const shared = mulPointEscalar(pkBuyer, ephSk);
	const nonce = 0n;
	const ciphertext = encrypt(plaintext, shared, nonce);
	const ciphertextHash = hashChain32(ciphertext);

	const input = {
		plaintext,
		sigR8x: sig.R8[0],
		sigR8y: sig.R8[1],
		sigS: sig.S,
		ephemeralSk: ephSk,
		recordCommit,
		medicPkX: medicPk[0],
		medicPkY: medicPk[1],
		pkBuyerX: pkBuyer[0],
		pkBuyerY: pkBuyer[1],
		ephemeralPkX: ephPk[0],
		ephemeralPkY: ephPk[1],
		ciphertextHash,
		nonce,
	};

	const t0 = Date.now();
	const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, WASM, ZKEY);
	console.log(`✓ proof generated in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

	const valid = await snarkjs.groth16.verify(VKEY, publicSignals, proof);
	if (!valid) {
		console.error("✗ proof failed off-chain verify");
		process.exit(1);
	}
	console.log("✓ proof verifies off-chain");

	// Pub signal layout sanity.
	const expected = [
		recordCommit,
		medicPk[0],
		medicPk[1],
		pkBuyer[0],
		pkBuyer[1],
		ephPk[0],
		ephPk[1],
		ciphertextHash,
		nonce,
	];
	for (let i = 0; i < 9; i++) {
		if (BigInt(publicSignals[i]) !== expected[i]) {
			console.error(`pubSignals[${i}] mismatch: got ${publicSignals[i]}, expected ${expected[i]}`);
			process.exit(1);
		}
	}
	console.log("✓ 9 public signals match expected layout");

	// Researcher-side recovery.
	const sharedR = mulPointEscalar(ephPk, skBuyer);
	if (sharedR[0] !== shared[0] || sharedR[1] !== shared[1]) {
		console.error("✗ ECDH mismatch");
		process.exit(1);
	}
	const plaintextR = decrypt(ciphertext, sharedR, nonce);
	for (let i = 0; i < N; i++) {
		if (plaintextR[i] !== plaintext[i]) {
			console.error(`✗ decrypted slot ${i} mismatch`);
			process.exit(1);
		}
	}
	const decodedR = decodeRecordFromFieldElements(plaintextR);
	if (canonStringify(decodedR) !== canonStringify(fields)) {
		console.error("✗ researcher decoded record differs", { expected: fields, got: decodedR });
		process.exit(1);
	}
	console.log("✓ researcher recovers original record byte-exact via ECDH decrypt");
}

// ---- Test cases ----

await runCase("ASCII record (typical)", {
	name: "Alice",
	age: "34",
	condition: "diabetes",
	bloodType: "A+",
});

await runCase("empty values", { a: "", b: "" }, { skipProof: true });

await runCase("UTF-8 multibyte", {
	"名前": "愛麗絲",
	"診断": "糖尿病",
	"血液型": "A+",
}, { skipProof: true });

// At-capacity edge: fill exactly to MAX_PAYLOAD_BYTES.
// k=1 byte, separators=2 bytes ⇒ value gets 958 bytes.
await runCase(
	"at-capacity",
	{ k: "x".repeat(MAX_PAYLOAD_BYTES - 3) },
	{ skipProof: true },
);

// Overflow must throw.
try {
	encodeRecordToFieldElements({ k: "x".repeat(MAX_PAYLOAD_BYTES) });
	console.error("✗ expected overflow to throw");
	process.exit(1);
} catch (e) {
	if (!String(e.message).includes("too large")) {
		console.error("✗ unexpected error:", e.message);
		process.exit(1);
	}
	console.log("\n=== overflow ===\n✓ encoder rejects oversized record");
}

// Reserved byte rejection.
try {
	encodeRecordToFieldElements({ k: "a\x1fb" });
	console.error("✗ expected reserved-byte rejection");
	process.exit(1);
} catch (e) {
	if (!String(e.message).includes("reserved control byte")) {
		console.error("✗ unexpected error:", e.message);
		process.exit(1);
	}
	console.log("=== reserved byte ===\n✓ encoder rejects US/RS in input");
}

console.log("\nAll cases passed.");
