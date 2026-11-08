# Unified Sol PayApp 🇮🇳 → ✅ Solana

**UPI, rebuilt on Solana.** Send money the way India's Unified Payments Interface works — by a simple, memorable handle (`name@solpay`) — backed by Solana's ~400ms finality and sub-penny fees.

> Built for the [MLH Solana Hackathon](https://events.mlh.com/events/15200-solana-hackathon) — **DeFi Track** (payments & stablecoins).

## The UPI → Solana mapping

| UPI concept | Unified Sol PayApp |
|---|---|
| VPA / UPI ID (`pranav@okaxis`) | On-chain handle (`pranav@solpay`) |
| NPCI directory (handle → bank) | Anchor program on Solana devnet (handle → wallet) |
| Scan & Pay QR | UPI-toned QR that encodes a Solana Pay URL |
| ₹ transfer | Devnet SOL transfer, finality in seconds |
| Payment history / passbook | Signature history straight from the devnet ledger |

## Core flows

1. **Register a handle** — link a `yourname@solpay` VPA to your Solana wallet on-chain.
2. **Pay by handle** — type `someone@solpay`, get the resolved wallet, confirm, done.
3. **Scan & Pay** — generate/scanning a QR that encodes the payment intent; no typing addresses.
4. **Passbook** — your transaction history, read directly from devnet signatures.

## Architecture

- `programs/` — Anchor program (`handle registry` PDA: `handle → wallet owner`), deployed on **Solana devnet**.
- `app/` — Vite + React front end with Solana wallet-adapter, `@solana/pay` QRs, and RPC-driven history.
- Transactions are **real** — this is a working product, not a mockup.

## Setup

See **`USERGUIDE.md`** for the 1-minute app walkthrough and **`implementation.md`** for build/deploy steps.
Tests: `cd app && node tests/unit.test.mjs` (15 checks) · post-deploy: `node tests/devnet.test.mjs` (7 live-devnet claims).

## Demo script

_See `DEMO.md`._

## Track fit — DeFi (payments)

- Solana chosen for what it's good at: **instant settlement (~1s), sub-penny fees, composable on-chain state**.
- The handle registry is an actual program — payable, upgradeable, composable (any other dApp can resolve `x@solpay`).
- Natural next steps: USDC/INR-stablecoin support, autopay (standing instructions), collect-request flows — i.e., more of the UPI surface on Solana rails.
