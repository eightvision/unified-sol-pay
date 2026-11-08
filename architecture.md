# Architecture — Unified Sol PayApp

## System view

```
┌─────────────────┐         ┌───────────────────────────────┐
│  Browser SPA    │  RPC    │          Solana devnet        │
│  Vite + React   │◄────────┤  Anchor program               │
│  wallet-adapter │  JSON   │   • HandleRecord PDA per      │
│  (Phantom etc.) │         │     [b"upi", handle]          │
└─────────────────┘         │   • register_handle()         │
                            │   • pay_to_handle()           │
   data is on-chain;        │        ↑ CPI                  │
   no private database,     └───────────────────────────────┘
   no backend.
```

No server peering: every judge-facing feature is either browser + wallet or a public devnet RPC read.

## The core primitive
`[b"upi", handle]` → `HandleRecord{ authority }`

| Concept | What goes on-chain | What stays off-chain |
|---|---|---|
| Handle registry | PDA per handle holding owner wallet | UX (the "sign up" form, suffix `@solpay` display) |
| Pay by handle | System transfer + PDA enforced recipient | Keystrokes + confirmation UI |
| Passbook | signatures exist on the ledger, already | Rendering + naming; "you" (per wallet) |

That's the essence of blockchain-native payments UX: *the ledger is authoritative state, not a log*.

## Sequence — Register
1. User plugs their Phantom/Solflare wallet into the SPA; typed handle `pranav` gets rendered as `pranav@solpay`.
2. SPA derives known PDA → PDA check (does not exist).
3. Wallet signs; anchor `init` creates `HandleRecord { authority: user }`.
4. Success screen shows the explorer link (verifiably real).

## Sequence — Pay to Handle
1. Sender types `pranav@solpay` + amount.
2. SPA sends tx with accounts: sender, **recipient = record.authority (from client resolution)**, record PDA, system program.
3. The program **re-checks** recipient == record.authority → false attempts self-fail at program level, so the fee-payer can't redirect money unless they hold the handle.
4. Fee: transfer + record read ≈ sub-penny; finality: ~400ms, "Done" toast shows full signature + explorer link.

## QR flow — Solana Pay
- Send side: `@solana/pay` "My QR" encodes `solana:<wallet>?amount&label=@my@solpay` with our program origin noting.
- Payer side (resolve button): paste URL or a reference, we resolve `@` handle from registry.
- Photographic: zero click-through typing in the demo.

## Tech debt ledger (consciously deferred)
- Per-fee kora / paymaster "gasless" flows — not needed for devnet.
- Rust unit tests (LiteSVM) — program logic is ~50 lines and program-enforced checks are standard `init`/PDA invariants.
- React state library — hand-rolled with hooks is enough for 4 screens.
