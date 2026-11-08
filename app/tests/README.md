# Tests — Unified Sol PayApp

Three layers, one rule: **no red x over production claims.**

## 1 · Unit (`tests/unit.test.mjs`) — zero-network
Pure client-library checks: handle normalize/validate rules, borsh arg encodings, Anchor discriminator math, PDA derivation stability & collision spread, instruction keys layout (signer/writable/program ids), record parsing layout, Solana Pay URL format.

```bash
cd app && node tests/unit.test.mjs   # 15 checks — must be green before ANY devnet run
```

## 2 · Integration (`tests/devnet.test.mjs`) — real devnet, after deploy
Runs `e2e.mjs` end to end with two fresh wallets and asserts every claim the product makes:

| # | Claim being verified on a live chain |
|---|---|
| 1 | Faucet funds arrive on a fresh wallet (or fail loudly with evidence) |
| 2 | `register_handle` tx lands on devnet and confirms |
| 3 | The registry record: **owned by our program**, has the correct Anchor discriminator, **authority = registrant's wallet** |
| 4 | `pay_to_handle` settles exactly `amount` lamports to the handle's authority |
| 5 | Fees are sub-penny (checked numerically against transfer amount) |
| 6 | **Negative control**: paying the same handle to a *different* recipient **fails at program level** (anti-redirect invariant) |
| 7 | Both parties' history shows the actual signatures via RPC |

```bash
cd app && node tests/devnet.test.mjs   # requires deployed program + funded wallet
```

## 3 · The e2e gate (`e2e.mjs`)
The single MVP verifier named in the Goal contract — `tests/devnet.test.mjs` wraps it, and it's also run directly against the **deployed URL** before hand off. Output gives explorer links for every tx so a human can audit any green check.

## Post-deploy flow
1. `anchor build` → `solana program deploy` (see implementation.md)
2. `node tests/unit.test.mjs` (already green)
3. `node tests/devnet.test.mjs`
4. UI passes same flows against the live URL (manual, via USERGUIDE.md)
