# Tasks — Unified Sol PayApp

Legend: ☐ todo · 🔄 in progress · ✅ done · ⛔ blocked (needs user input)

---

## Phase 0 — Foundations
- ☐ Re-install toolchain (removed at user request): Rust, Solana CLI, Anchor CLI — exact steps in `implementation.md`
- ☐ Devnet payer wallet + program keypair; **airdrop ≥ 2 SOL** (risk: faucet rate-limit; fallback list in plan.md)
- ☐ Scaffold Vite+React app in `app/` (done in session — kept)
- ✅ Project sandbóxed: everything inside `/Users/pranav/Documents/Unified_Sol_PayApp`

## Phase 1 — On-chain (Anchor program)
- ✅ Program source drafted: `HandleRecord { authority, bump, created_at }`, PDA seeds `[b"upi", handle]`
- ✅ Instructions: `register_handle(handle)` · `pay_to_handle(handle, amount)` with program-enforced recipient
- ✅ Validation: 1–32 chars, `[a-z0-9._-]`, `@` rejected
- ☐ `anchor build` green (one `overflow-checks` profiler fix applied; needs re-install of toolchain first)
- ☐ Deploy to devnet (program ID auto-synced by Anchor at build time)

## Phase 2 — Headless e2e (before any UI polish)
- ☐ Node script: two fresh keypairs → wallet A registers `friend@solpay`
- ☐ wallet B resolves + pays 100k lamports by handle → **tx signature on devnet**
- ☐ wallet A wastes the QR path: Solana Pay URL → parse → resolved → paid
- ☐ History proof: A and B both fetch real signatures via RPC

## Phase 3 — UI (UPI-toned)
- ☐ Wallet-adapter wiring (Phantom/Solflare), devnet forced
- ☐ Home/pay screen: handle input ✔ resolves live; QR Scan entry
- ☐ Register screen + success toast like UPI's "handle created"
- ☐ QR tab: window shows a personal QR + a scan support to pay others
- ☐ Passbook: on-chain signature list + explorer links

## Phase 4 — Ship
- ☐ Vercel (or equivalent) deployment with URL; env typed: `VITE_SOLANA_NETWORK=devnet`
- ☐ Run the e2e script **against the deployed URL's program** (same 2-wallet flow)
- ☐ README setup + architecture + track-fit (exists; keep in sync)
- ✅ `DEMO.md` shot-list script (exists; refresh to final flow order)
- ☐ Public repo push
- ☐ Handoff message to user with the 3 things they do: record video, submit, sign-off

## Blocked-stop artifacts (if any)
-What failed · what was tried · evidence · what the user must provide to unblock — must go to the user's chat at handoff time (e.g. ⛔ faucet + Vercel-creds fallbacks).
