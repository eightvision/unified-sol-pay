# USERGUIDE — Unified Sol PayApp

Paying people by a simple name — the way UPI does it — but settled on Solana in under a second for a fraction of a cent.

---

## What you need (once, ~1 minute)
1. **A browser wallet** — install [Phantom](https://phantom.app) or [Solflare](https://solflare.com). Chrome/Brave/Edge/Android, or Phantom on iOS.
2. **Devnet SOL (demo money)** — the app runs on Solana **devnet** (free playground, zero real funds):
   - open the wallet → switch network to **Devnet**,
   - copy your wallet address, paste it into the faucet: **https://faucet.devnet.solana.com** → a few SOL arrive in seconds.
   - (If the faucet link is busy, try again a minute later — devnet gives a per-day limit per address.)

---

## The flows (every one settles a *real* transaction)

### 1 · Create your handle — `you@solpay`
1. Open the app → click **Connect** → pick your wallet.
2. Your **Devnet balance** shows on top.
3. In *Your UPI-style handle*, type any name: `user`, `sneha.razor`, `cafe_42`…
   - the bar under the input shows **`user@solpay · available ✓`** live.
4. **Create** → sign with Phantom → toast **`pranav@solpay created on Solana ✓`** + an explorer link.
That handle→wallet mapping is now on the ledger — any other wallet/device gets the same answer, no logins anywhere.

### 2 · Pay someone by handle — the classic UPI moment
1. **Pay** (orange button) → type `friend@solpay`.
2. The **payee card** resolves and shows the handle + wallet suffix — exactly like UPI showing the bank name under the VPA.
3. Tap the amount on the numpad (`0.05`…) — the fee line shows *≈ sub-penny*.
4. **Send ◎0.05** → approve in Phantom → **`Payment sent ✓`** with the explorer signature link.
   Settled in about a second. No "bank names" to choose, no IFSC, no OTP-after-the-fact.

### 3 · My QR / Scan & Pay
- **My QR** tab shows your personal **Solana Pay** QR — print it, screenshot it, phone-scan it.
- **Scan & Pay** opens the camera (Chrome desktop / Android; other browsers can paste a handle instead) → resolves the scanned handle → **Pay** pre-completes the sheet.

### 4 · Passbook — a real ledger, not a fake list
Every row is a signed devnet transaction with the **explorer link**. ⚡ rows are Unified-Sol-PayApp transactions; ↓/↑ rows are raw transfers. Spent/earned amounts and the confirmed status come from the RPC, not our imagination.

---

## Judges' 30-second audit path
1. Open the deployed URL anywhere (no install).
2. Register handle → open one explorer link → you see `Create Account + our program` on-chain.
3. Pay a second wallet by handle → success modal in ~1s with explorer link.
4. Watch the **Passbook** fill with real signature rows in both wallets.
5. Optional: `cd app && node tests/devnet.test.mjs` replays the whole flow headlessly with **15 unit + 7 integration** checks.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Balance shows ◎ — | switch wallet to **Devnet**, then faucet (§once, step 2) |
| "handle already claimed" | it really is on-chain — pick another spelling (handles are immutable for now) |
| Payment stuck "Signing…" | approve inside Phantom; check you're on Devnet |
| `failed to send transaction` | devnet RPC blip — tap Try again; usually instant |
| Camera falls back to paste | the browser lacks `BarcodeDetector` — paste handle instead |
| "amount + fees insufficient" | faucet some more SOL |

## Glossary
- **handle / VPA** — `name@solpay`, a memorable address payable via the on-chain registry.
- **lamport** — the smallest SOL unit (1e-9); what fees are counted in.
- **devnet** — free Solana test network where tokens are worth nothing.
- **explorer link** — crypto's receipt; every tx is publicly verifiable.

*Next phases (post-hackathon): USDC/INR-stablecoin amounts, collect-request ("accept payment"), autopay/standing instructions, gasless UX via paymaster.*
