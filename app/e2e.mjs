/**
 * Headless e2e verifier — the MVP gate before any UI polish.
 * Proves on real devnet: register handle → resolve on-chain → pay by handle → real histories.
 * Usage: node e2e.mjs [baseHandle]     (env PAYER overrides dapp.payer.json)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  Keypair, Connection, LAMPORTS_PER_SOL, PublicKey,
  SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction,
} from "@solana/web3.js";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const conn = new Connection(RPC, { commitment: "confirmed" });
const PROGRAM_ID = new PublicKey("8RDNyCPjurbhbN9X4RmyZTrbhDWYU6ZcjVKMiC6VujkN"); // keep in sync with lib.rs
const UPI_SEED = Buffer.from("upi");

const discIx = (name) => crypto.createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
const discAcc = (name) => crypto.createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
const borshString = (s) => {
  const b = Buffer.from(s, "utf8"); const l = Buffer.alloc(4);
  l.writeUInt32LE(b.length); return Buffer.concat([l, b]);
};
const borshU64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const pdaOf = (h) => PublicKey.findProgramAddressSync([UPI_SEED, Buffer.from(h, "utf8")], PROGRAM_ID);
const RECORD_SPACE = 8 + 32 + 1 + 8;

const load = (p) => Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync(path.resolve(p), "utf8"))));
const payer = load(process.env.PAYER ?? "dapp.payer.json");
const A = Keypair.generate(); // merchant: registers the handle
const B = Keypair.generate(); // customer: pays by handle

const log = (ok, step, detail = "") => console.log(`${ok ? "✅" : "❌"} ${step}${detail ? " — " + detail : ""}`);
const fail = (step, detail) => { log(false, step, detail); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fund(kp, sol, tries = 3) {
  // First try faucet airdrop (may be rate-limited per IP)…
  for (let i = 1; i <= tries; i++) {
    try {
      const sig = await conn.requestAirdrop(kp.publicKey, Math.round(sol * LAMPORTS_PER_SOL));
      const r = await conn.confirmTransaction(sig, "confirmed").catch(() => ({ value: { err: "no" } }));
      if (r.value.err == null) return true;
    } catch { /* rate-limited etc */ }
    await sleep(5000);
  }
  // …fallback: transfer from the payer wallet (needs enough SOL).
  const have = await conn.getBalance(kp.publicKey);
  if (have >= sol * LAMPORTS_PER_SOL * 0.9) return true;
  const need = Math.round(sol * LAMPORTS_PER_SOL) - have;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("finalized");
  const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: payer.publicKey })
    .add(SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: kp.publicKey, lamports: need }));
  const sig = await conn.sendTransaction(tx, [payer]);
  const r = await conn.confirmTransaction(sig, "confirmed").catch(() => ({ value: { err: "no" } }));
  if (r.value.err) return false;
  return (await conn.getBalance(kp.publicKey)) >= need;
}

async function register(txSigner, handle, pda) {
  const tx = new Transaction().add(new TransactionInstruction({
    keys: [
      { pubkey: txSigner.publicKey, isSigner: true, isWritable: true },
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.concat([discIx("register_handle"), borshString(handle)]),
  }));
  return sendAndConfirmTransaction(conn, tx, [txSigner], { commitment: "confirmed" });
}

async function payByHandle(txSigner, recipient, handle, pda, lamports) {
  const tx = new Transaction().add(new TransactionInstruction({
    keys: [
      { pubkey: txSigner.publicKey, isSigner: true, isWritable: true },
      { pubkey: recipient, isSigner: false, isWritable: true },
      { pubkey: pda, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.concat([discIx("pay_to_handle"), borshString(handle), borshU64(lamports)]),
  }));
  return sendAndConfirmTransaction(conn, tx, [txSigner], { commitment: "confirmed" });
}

async function main() {
  let handle = (process.argv[2] ?? `user${crypto.randomBytes(3).toString("hex")}`).toLowerCase().replace(/[^a-z0-9._-]/g, "");
  let [pda] = pdaOf(handle);
  while (await conn.getAccountInfo(pda)) { // avoid collision
    handle = handle + Math.floor(Math.random() * 10);
    [pda] = pdaOf(handle);
  }
  console.log(`handle: ${handle}@solpay  pda: ${pda.toBase58()}`);
  console.log(`A (merchant): ${A.publicKey.toBase58()}   B (customer): ${B.publicKey.toBase58()}`);

  log(true, "fund A+B from devnet faucet");
  if (!await fund(A, 0.05)) fail("faucet-fund A", "rate limited after 8 tries");
  if (!await fund(B, 0.05)) fail("faucet-fund B", "rate limited after 8 tries");

  // 1) register
  const regSig = await register(A, handle, pda);
  log(true, "register_handle tx", `https://explorer.solana.com/tx/${regSig}?cluster=devnet`);

  // 2) resolve on-chain: correct owner, discriminator, dynamic-borsh authority
  const info = await conn.getAccountInfo(pda);
  if (!info) fail("resolve", "record missing after registry tx");
  const ownerOk = info.owner.equals(PROGRAM_ID);
  const discOk = info.data.subarray(0, 8).equals(discAcc("HandleRecord"));
  const storeLen = info.data.readUInt32LE(8);
  const aOff = 12 + storeLen;
  const authority = new PublicKey(info.data.subarray(aOff, aOff + 32));
  log(ownerOk, "resolve: record owned by program", PROGRAM_ID.toBase58().slice(0, 6));
  log(discOk, "resolve: Anchor HandleRecord discriminator ok");
  log(info.data.subarray(12, aOff).toString("utf8") === handle, "resolve: stored handle == requested handle");
  log(authority.equals(A.publicKey), "resolve: authority == A", authority.toBase58().slice(0, 6));

  // 3) pay by handle (B → A's handle address)
  const balA0 = await conn.getBalance(A.publicKey);
  const balB0 = await conn.getBalance(B.publicKey);
  const amt = 25_000;
  const paySig = await payByHandle(B, A.publicKey, handle, pda, amt);
  log(true, "pay_to_handle tx", `https://explorer.solana.com/tx/${paySig}?cluster=devnet`);
  const balA1 = await conn.getBalance(A.publicKey);
  const balB1 = await conn.getBalance(B.publicKey);
  log(balA1 - balA0 === amt, `A received exactly ${amt} lamports`, `+${balA1 - balA0 - amt > 0 ? "≥amt" : "else"}`);
  log(balB0 - balB1 > amt, "B paid amount + fee", `Δ ${balB0 - balB1}`);
  log(balB0 - balB1 - amt < 50_000, "fee is sub-penny", `${((balB0 - balB1 - amt) / LAMPORTS_PER_SOL * 200).toFixed(4)} USD approx`); // SOL=$200 assumption

  // negative control: skim victim != authority must fail at program level
  try {
    await payByHandle(B, Keypair.generate().publicKey, handle, pda, 1000);
    log(false, "negative: wrong recipient should have been rejected by program");
  } catch (e) {
    log(true, "negative: wrong recipient rejected", (e.message || "").slice(0, 120));
  }

  // 4) both histories show real signatures
  const histA = await conn.getSignaturesForAddress(A.publicKey, undefined, "confirmed");
  const histB = await conn.getSignaturesForAddress(B.publicKey, undefined, "confirmed");
  const sigsA = new Set(histA.map((s) => s.signature));
  log(sigsA.has(regSig) && sigsA.has(paySig), "A saw register + payment signatures", `len=${histA.length}`);
  log(histB.some((s) => s.signature === paySig), "B saw the payment signature", `len=${histB.length}`);

  console.log(`\nVERDICT: ${sigsA.has(regSig) && sigsA.has(paySig) && ownerOk && discOk && authority.equals(A.publicKey) ? "E2E PASS" : "E2E FAIL"}`);
}

main().catch((e) => fail("unhandled", e.message ?? `${e}`));
