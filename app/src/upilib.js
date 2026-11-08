// Client library for the unified-sol-pay Anchor program.
// Pure functions only: no React, no DOM.
import { Buffer } from "buffer";
import {
  PublicKey, SystemProgram, Transaction, TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";

export const NETWORK = "devnet";
export const LAMPORTS = LAMPORTS_PER_SOL;

/** Program ID — MUST stay in sync with programs/unified-sol-pay/src/lib.rs declare_id! */
export const PROGRAM_ID = new PublicKey("8RDNyCPjurbhbN9X4RmyZTrbhDWYU6ZcjVKMiC6VujkN");
const UPI_SEED = Buffer.from("upi");

// ── Anchor discriminators: sha256(prefix:label)[0..8] ──────────────────────
export function discIx(name) {
  return Buffer.from(nobleSha256(Buffer.from(`global:${name}`, "utf8"))).subarray(0, 8);
}
export function discAcc(name) {
  return Buffer.from(nobleSha256(Buffer.from(`account:${name}`, "utf8"))).subarray(0, 8);
}

// ── borsh-lite encodings for this program's args ──────────────────────────
export function borshString(s) {
  const b = Buffer.from(s, "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
}
export function borshU64(n) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}

// ── PDAs & handle utilities ───────────────────────────────────────────────
export function handlePda(handle) {
  return PublicKey.findProgramAddressSync(
    [UPI_SEED, Buffer.from(handle, "utf8")],
    PROGRAM_ID,
  )[0];
}

export function normalizeHandle(raw) {
  return raw.trim().toLowerCase().replace(/@.*$/, "").slice(0, 32);
}
export function isValidHandle(h) {
  return /^[a-z0-9._-]{1,32}$/.test(h);
}

// ── On-chain reads ────────────────────────────────────────────────────────
export function parseRecord(data) {
  const discOk = data.subarray(0, 8).equals(discAcc("HandleRecord"));
  if (!discOk) return null;
  // borsh: String = 4-byte LE length + utf8 bytes, then authority (32), bump (1), i64 ts (8)
  const handleLen = data.readUInt32LE(8);
  const off = 12 + handleLen;
  const handle = data.subarray(12, off).toString("utf8");
  const wallet = new PublicKey(data.subarray(off, off + 32));
  const bump = data[off + 32];
  const created_at = Number(data.readBigInt64LE(off + 33));
  return { handle, wallet, bump, created_at };
}

/** handle → { wallet: PublicKey|null, pda } — works with any Connection. */
export async function resolveHandle(conn, handle) {
  const pda = handlePda(handle);
  const info = await conn.getAccountInfo(pda);
  if (!info || !info.owner.equals(PROGRAM_ID)) return { wallet: null, pda };
  const rec = parseRecord(info.data);
  return rec ? { ...rec, pda } : { wallet: null, pda };
}

// ── Instruction builders ──────────────────────────────────────────────────
export function registerHandleTx(payer, handle) {
  return new Transaction().add(new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: handlePda(handle), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.concat([discIx("register_handle"), borshString(handle)]),
  }));
}

export function payToHandleTx(payer, recipient, handle, lamports) {
  return new Transaction().add(new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: true },
      { pubkey: handlePda(handle), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.concat([discIx("pay_to_handle"), borshString(handle), borshU64(lamports)]),
  }));
}

// ── Solana Pay URLs ("My QR") ─────────────────────────────────────────────
export function solpayUrl(walletStr, { label } = {}) {
  const labelPart = label ? `?label=${encodeURIComponent(label)}` : "";
  return `solana:${walletStr}${labelPart}`;
}
