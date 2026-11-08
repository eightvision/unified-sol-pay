# Implementation — Unified Sol PayApp

How the pieces are built, installed, and continued. Read this before running anything.

## 0. Toolchain install / reinstall (user removed installs this session)
Project needs Rust + Solana CLI (Agave) + Anchor. The official one-command installer (same "quick install" MLH page links to):

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

Installs to `~/.rustup`, `~/.cargo`, `~/.local/share/solana` only. Verified pairing from the previous install run:
- `solana-cli 3.1.10 (Agave)` ↔ `anchor-cli 1.1.2` ↔ `cargo-build-sbf 3.1.10` ↔ platform-tools v1.52

Rules while installing: nothing global beyond those dirs; no `npm install -g`; no surfpool required (skip if asked).

## 1. Wallets & keys
- `dapp.payer.json` — demo payer, lives in project root, **gitignored**.
- Program keypair — managed by `anchor build` under `target/deploy/` (gitignored).
- Program ID authority of truth: `programs/unified-sol-pay/src/lib.rs` `declare_id!` + `Anchor.toml` (Anchor auto-syncs these two together).
- Never read keyparsing into UI code; user's browser wallet (Phantom/Solflare) is the only on-app key holder.

## 2. On-chain program (`programs/unified-sol-pay`)
State: `HandleRecord { authority: Pubkey, bump: u8, created_at: i64 }`
PDA: `seeds = [b"upi", handle]` — **handles are the ledger key**: any client can resolve a handle with zero extra indirection.

| Instruction | Semantics |
|---|---|
| `register_handle(handle)` | `init` on PDA; store caller as authority. Fails if handle exists. |
| `pay_to_handle(handle, amount_lamports)` | CPI to System Program, `payer → recipient`; recipient forced equal to record's authority. |

Validation: 1–32 chars, only `[a-z0-9._-]`, rejects `@` so handles can't smuggle a second `@`.

Build & deploy:
```bash
NO_DNA=1 anchor build
solana program deploy target/deploy/unified_sol_pay.so --program-id ... --keypair ...
```
Workspace root `Cargo.toml` must keep `overflow-checks = true` (Anchor enforces).

## 3. Front end (`app/`)
- Vite + React 19, bundle: `@solana/web3.js@^1.99` + wallet-adapter line (Phantom/Solflare).
- `@solana/pay@^1.0.26` for QR encoding; `qrcode.react` for rendering.
- Anchor's generated TS types go to `app/src/anchor` per `[workspace] types` in Anchor.toml.
- Pin note: never upgrade web3.js to v3 this weekend — wallet-adapter peers on v1.

## 4. Headless e2e (the gate before UI polish)
Node script with two throwaway CLI keypairs:
1. A registers `friend@solpay`
2. B `pay_to_handle` 100_000 lamports → real signature
3. Both fetch history from RPC (with `maxSupportedTransactionVersion: 0` on web3.js v1 — v0 default for devnet txs).

This script is the MVP verifier; the deployed URL must pass the same calls.

## 5. Deploy / hosting
- Static SPA (no backend/RPC-proxying secrets needed) — vercel/netlify via CLI/token.
- If hosting creds needed → user; that's the ⛔ stop in the Goal contract, not a self-service workaround.

## 6. Repos & sandboxing
- git-inited inside project only. `.gitignore` already covers: `node_modules/`, `target/`, `.anchor/`, `.env`, `*.json.keypair`, `**/id.json`, `dapp.payer.json`, `programs/__keypair.json`, `.DS_Store`.
- Committing program sources is fine; committing keypair files is forbidden.

## 7. Tests (required after implementation — see `app/tests/README.md`)
1. `cd app && node tests/unit.test.mjs` — 15 pure checks (no net) — gate for anything devnet.
2. `cd app && node tests/devnet.test.mjs` — full integration via `e2e.mjs`: register/resolve/pay/negative-control/history on real devnet. Needs deployed program + funded wallet.
3. Same integration flow re-run against the **deployed URL** before final handoff.
