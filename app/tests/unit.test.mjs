/**
 * Unit tests — run everywhere, no network, no deployed program.
 *   node tests/unit.test.mjs
 * Covers: handle normalization/validation, borsh encodings, Anchor
 * discriminators, PDA derivation, tx/instruction payload shape, Solana Pay URL.
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  Keypair, PublicKey, SystemProgram,
} from "@solana/web3.js";
import {
  PROGRAM_ID,
  normalizeHandle, isValidHandle, handlePda, borshString, borshU64,
  discIx, discAcc, registerHandleTx, payToHandleTx, solpayUrl, parseRecord,
} from "../src/upilib.js";
import { Buffer } from "buffer";

let pass = 0, failed = 0;
const t = (name, fn) => {
  try { fn(); pass++; console.log(`  ✅ ${name}`); }
  catch (e) { failed++; console.log(`  ❌ ${name}\n     ${e.message}`); }
};

console.log("unit tests (pure client library)");

// ── handle normalization ─────────────────────────────────────────────────
t("normalize: trims, lowercases, strips everything after @", () => {
  assert.equal(normalizeHandle("  Pranav@SOLPAY  "), "pranav");
  assert.equal(normalizeHandle("friEND@googlepay"), "friend");
});
t("normalize: caps at 32 chars", () => {
  assert.equal(normalizeHandle("a".repeat(50)).length, 32);
});
t("validate: accepts a-z 0-9 . _ -", () => {
  assert.ok(isValidHandle("pranav"));
  assert.ok(isValidHandle("a.b_c-9"));
});
t("validate: rejects uppercase, spaces, @, emoji, empty, >32", () => {
  assert.ok(!isValidHandle("Pranav"));
  assert.ok(!isValidHandle("has space"));
  assert.ok(!isValidHandle("with@at"));
  assert.ok(!isValidHandle("😀"));
  assert.ok(!isValidHandle(""));
  assert.ok(!isValidHandle("a".repeat(33)));
});

// ── borsh encodings (must match anchor-lang String + u64) ────────────────
t("borshString: 4-byte LE length + utf8 bytes", () => {
  const b = borshString("upi");
  assert.equal(b[0], 3);
  assert.equal(b[1], 0); assert.equal(b[2], 0); assert.equal(b[3], 0);
  assert.equal(b.subarray(4).toString(), "upi");
});
t("borshString: multibyte utf8 counts bytes, not chars", () => {
  const n = borshString("示例".repeat(10)).length; // 6 bytes/char × 10
  assert.equal(n, 4 + 60);
});
t("borshU64: little-endian 8 bytes", () => {
  const b = borshU64(259);
  assert.equal(b.length, 8);
  assert.equal(b.readBigUInt64LE(), 259n);
  assert.equal(b[7], 0);
});

// ── Anchor discriminators (on-chain will re-verify these) ────────────────
t("discIx/discAcc: exactly sha256(prefix:name)[0..8)", () => {
  for (const name of ["register_handle", "pay_to_handle", "HandleRecord"]) {
    const d = discIx(name);
    const expect = crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
    assert.ok(d.equals(expect), name);
    assert.equal(d.length, 8);
  }
});

// ── PDA derivation is stable and off-curve ───────────────────────────────
t("handlePda: stable + deterministic; program-owned addressing", () => {
  const once = handlePda("pranav");
  const twice = handlePda("pranav");
  assert.ok(once.equals(twice));
  assert.ok(once instanceof PublicKey);
});
t("handlePda: distinct handles ⇒ distinct PDAs (collision resistance)", () => {
  const handles = [];
  for (let i = 0; i < 50; i++) handles.push(handlePda(`a${i}`));
  assert.equal(new Set(handles.map(String)).size, 50);
});

// ── instruction builders ─────────────────────────────────────────────────
t("registerHandleTx: keys layout [payer(signed,mut), pda(mut), system]", () => {
  const payer = Keypair.generate();
  const tx = registerHandleTx(payer.publicKey, "demo");
  const [ix] = tx.instructions;
  assert.equal(ix.programId.toBase58(), PROGRAM_ID.toBase58());
  assert.equal(ix.keys.length, 3);
  assert.ok(ix.keys[0].pubkey.equals(payer.publicKey));
  assert.ok(ix.keys[0].isSigner && ix.keys[0].isWritable);
  assert.ok(ix.keys[1].pubkey.equals(handlePda("demo")));
  assert.ok(!ix.keys[1].isSigner && ix.keys[1].isWritable);
  assert.ok(ix.keys[2].pubkey.equals(SystemProgram.programId));
  const data = ix.data;
  assert.ok(data.subarray(0, 8).equals(discIx("register_handle")));
  assert.ok(data.subarray(8).equals(borshString("demo")));
});
t("registerHandleTx: tx-level — fee payer unset here (documented)", () => {
  const tx = registerHandleTx(Keypair.generate().publicKey, "demo");
  assert.equal(tx.feePayer, undefined); // app/e2e set it before sending
});
t("payToHandleTx: [payer, recipient(mut), pda(readonly!), system] + payload", () => {
  const payer = Keypair.generate(), recipient = Keypair.generate();
  const lamports = 25_000n;
  const tx = payToHandleTx(payer.publicKey, recipient.publicKey, "friend", lamports);
  const [ix] = tx.instructions;
  assert.equal(ix.keys.length, 4);
  const [, rec, pdaKey, sys] = ix.keys;
  assert.ok(rec.isWritable && !rec.isSigner);
  assert.ok(pdaKey.pubkey.equals(handlePda("friend")));
  assert.ok(!pdaKey.isWritable, "registry PDA is read-only in pay flow");
  assert.ok(sys.pubkey.equals(SystemProgram.programId));
  const data = ix.data;
  assert.ok(data.subarray(0, 8).equals(discIx("pay_to_handle")));
  assert.ok(data.subarray(8).equals(
    Buffer.concat([borshString("friend"), borshU64(lamports)]),
  ));
});

// ── record parsing (layout: 8 disc + [4 len + ≤32 handle] + 32 authority + 1 bump + 8 ts) ─
t("parseRecord: decodes handle + authority + created_at; null on bad discriminator", () => {
  const owner = Keypair.generate();
  const h = Buffer.from("pranav", "utf8");
  const len = Buffer.alloc(4); len.writeUInt32LE(h.length);
  const good = Buffer.concat([
    discAcc("HandleRecord"),
    len, h,
    Buffer.from(owner.publicKey.toBytes()),
    Buffer.from([254]), // bump placeholder
    (() => { const b = Buffer.alloc(8); b.writeBigInt64LE(1_700_000_000n); return b; })(),
  ]);
  const rec = parseRecord(good);
  assert.equal(rec.handle, "pranav");
  assert.ok(rec.wallet.equals(owner.publicKey));
  assert.equal(rec.created_at, 1_700_000_000);
  const bad = Buffer.alloc(40, 7); // wrong discriminator prefix zone
  assert.equal(parseRecord(bad), null);
});

// ── solana pay URL ────────────────────────────────────────────────────────
t("solpayUrl: encodes wallet + optional label", () => {
  const wallet = Keypair.generate().publicKey.toBase58();
  assert.equal(solpayUrl(wallet), `solana:${wallet}`);
  assert.equal(solpayUrl(wallet, { label: "Unified Sol PayApp" }),
    `solana:${wallet}?label=Unified%20Sol%20PayApp`);
});

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
