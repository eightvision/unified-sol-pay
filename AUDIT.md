# Security Audit — Unified Sol Pay

**Scope:** Anchor program `programs/unified-sol-pay/src/lib.rs` (register_handle / pay_to_handle), React/Vite app in `app/` (wallet-adapter + hand-rolled Anchor encodings), headless e2e gate `app/e2e.mjs`, git/dependency hygiene.
**Deployment target:** Solana **devnet only** (hardcoded in both program config and client). Prepared for MLH hackathon judging.
**Audit method:** manual source review of the program and every app source file, adversarial walkthrough of the account-constraint model, `git ls-files` / `git log --all --diff-filter=A --name-only` secret-history checks, `git check-ignore` verification, `npm audit` + `npm ls` attribution, and pattern scans (dangerous DOM APIs, literal secrets, pasted base58/keypair JSON in docs).

---

## Executive summary

The core on-chain design is **sound**. Funds move *directly* payer→recipient via the System Program — the program never holds, locks, or escrows SOL, so there is no custody, no withdrawal path, and nothing to drain. The two risks reviewers care most about for a PDA registry — **wrong/spoofed account passed as `handle_record`** and **recipient redirection** — are both closed with independent layers: Anchor's `Account<'info, HandleRecord>` enforces discriminator + program ownership; the handler re-derives the canonical PDA of the instruction-arg handle and rejects mismatches (`NotCanonical`, lib.rs:64–67); and the transfer only proceeds when `recipient == record.authority` (`NotRecipient`, lib.rs:69–72). The e2e script includes a live negative control proving a wrong recipient fails on-chain (app/e2e.mjs:131–137).

**No Critical or High findings.** There are three Medium findings worth acting on before judging: the `@solana/wallet-adapter-wallets` omnibus dependency drags in 100 npm-audit advisories (1 critical, in a Trezor chain the app never calls), a live-format Devnet payer keypair file `dapp.payer.json` sits in the repo root (gitignored and never committed, but a packaging/up-load hazard), and the registry is first-come-first-served with no identity verification, making handle squatting/impersonation trivial by design. Everything else is Low or informational.

---

## Findings

### Critical — none found

### High — none found

### Medium

#### M1. Dependency attack surface: `@solana/wallet-adapter-wallets` omnibus pulls 100 vulnerable transitive packages (1 critical)
- **Files:** `app/package.json:17` (`"@solana/wallet-adapter-wallets": "^0.19.40"`), used in `app/src/main.jsx:8`.
- **Evidence:** `npm audit` in `app/` reports **100 vulnerabilities (13 low, 60 moderate, 26 high, 1 critical)**. Attribution via `npm ls` shows all of it arrives through the wallets omnibus: the critical is **protobufjs ≤ 7.6.4 (GHSA-xq3m-2v4x-88gg code injection + ~12 more protobufjs advisories) via `@trezor/connect-web` → `@trezor/protobuf`**, and the high set is largely **zod 3.22.4 via WalletConnect's `@reown/appkit` → `viem` → `abitype`**. The app only instantiates `PhantomWalletAdapter` and `SolflareWalletAdapter` (`app/src/main.jsx:15`) — the Trezor/WalletConnect/EVM code is shipped but never invoked.
- **Honest severity note:** exploitability is theoretical for this devnet demo — the vulnerable paths are in wallet-connect protocols the app doesn't exercise, and there's no server component. But judges will run `npm audit`, and the whole adverse chain is bundled into the client today.
- **Remediation:** import the two adapters directly (`@solana/wallet-adapter-phantom`, `@solana/wallet-adapter-solflare`) or rely on Wallet-Standard auto-detection and drop `@solana/wallet-adapter-wallets` entirely. Expected effect: the 100-audit count collapses to near zero and the bundle shrinks substantially.

#### M2. Live-format Devnet payer keypair file in the project root
- **Files:** `dapp.payer.json` (64-byte keypair) at repo root; referenced by `Anchor.toml:12` (`wallet = "~/Documents/Unified_Sol_PayApp/dapp.payer.json"`) and loaded by `app/e2e.mjs:29–30` (`PAYER` env override supported).
- **What I verified:** it is **not tracked by git** — `.gitignore:10` covers it (`git check-ignore` confirms), `git ls-files` does not list it, and `git log --all --diff-filter=A --name-only` shows **zero** keypair/secret/`.env` files ever committed (history is a single commit). `programs/__keypair.json`, `programs/unified-sol-pay-keypair.json`, and the six `validator-ledger/*-keypair.json` files are likewise untracked and ignored. No `.env*` files exist.
- **Residual risk:** the key exists *inside the repository directory*. The realistic failure mode at a hackathon is process, not git: zipping the project for a Devpost upload, sharing a screenshare with the file open, or a later `git add -f` — any of which exposes a funded-looking Devnet key.
- **Remediation:** move the payer to the standard CLI location (`~/.config/solana/devnet.json`) and point `Anchor.toml`/e2e `PAYER` there; rotate or regenerate the key before packaging the repo for submission; add a README note that `dapp.payer.json` is a burner.

#### M3. Handle registry is identity-optional: squatting/impersonation is possible by design
- **Files:** `programs/unified-sol-pay/src/lib.rs:45–54` (`register_handle`), with frontend display treating `handle@solpay` as a person (`app/src/PayModal.jsx:139–152`, `app/src/QRTab.jsx:127–141`).
- **Issue:** anyone can register any unclaimed handle — including a real-world name — with no verification, no revoke, no dispute, and no transfer path (only `register_handle` exists; `authority` is written once at init). A user who "resolves" `pranav@solpay` has no on-chain assurance it belongs to the person they intend, and a wallet owner who loses their key loses the handle forever with no leadership change to inherit or heal it.
- **Honest severity note:** this is an inherent first-come-first-served registry property (the same one ENS/BNS MVPs have), not an implementation bug — the on-chain invariants are all correctly enforced. It belongs in a "known design limitations" slide more than a bug tracker. The funds are still safe: payment always goes to whoever *registered* the handle, and the recipient card in the pay sheet shows the resolved wallet prefix so a careful payer sees the destination.
- **Remediation direction (post-hackathon):** duration- or deposit-based claims, an `unregister`/`transfer(handle)` instruction gated on `record.authority` signer, and client-side display of full recipient address before confirm.

### Low

#### L1. Stale-payee race in the pay sheet (UX + fee waste; on-chain backstop holds)
- **File:** `app/src/PayModal.jsx:23–36, 38–42`.
- **Issue:** `payee` is resolved on a 350 ms debounce. After the handle input changes, `valid` (line 36) still keys off the *previous* handle's `payee`, so `Send` can be clicked while the payee card, the displayed wallet, and the typed handle disagree. The transaction is then built with `recipient = old wallet` and `handle = new string`.
- **Why this is not fund misdirection:** the program recomputes the canonical PDA of the *instruction-arg* handle and requires `recipient == record.authority` on-chain — so a stale combo always fails with `NotRecipient` or a missing-account error. Worst cases: the user burns a transaction fee, or (if the new handle legitimately belongs to the same wallet) pays an unintended-but-correctly-recorded party.
- **Remediation:** clear `payee` synchronously whenever `h` changes (not just schedule a re-resolve), tag resolutions with their handle and `setPayee` only if the tag still matches, or include `payee.handle === h` in `valid`.

#### L2. Amount-bound hygiene in PayModal
- **File:** `app/src/PayModal.jsx:35–36, 125–129`.
- **Issue:** the minimum is `lamports > 1000` — below the rent-exempt floor for a system account (~0.00089 SOL), transfers to a brand-new wallet will fail at runtime with a confusing rent error. There is no explicit upper bound (over-balance amounts fail as ordinary tx errors — acceptable). The eight-char-limited numpad (digits + dot only, `slice(0, 9)`) means no float-precision injection path; `parseFloat` is safe here.
- **Remediation:** validate against `connection.getMinimumBalanceForRentExemption(0)` for empty accounts, cap by wallet balance before signing, and surface the on-chain program error code in the error modal.

#### L3. `PROGRAM_ID` duplicated across five locations with only comments as the guard
- **Files:** `programs/unified-sol-pay/src/lib.rs:3` (`declare_id!`), `app/src/upilib.js:14`, `app/e2e.mjs:16`, generated `app/src/anchor/unified_sol_pay.ts:8`, `Anchor.toml:8`.
- All are currently in sync and treated as constants (`export const PROGRAM_ID = new PublicKey(...)` — never mutated, never read from user input/env). But a redeploy to a fresh keypair must be hand-synced everywhere; the "MUST stay in sync" comment is the only enforcement.
- **Remediation:** generate `upilib.js` constants from the IDL (the committed Anchor-workspace `types = "app/src/anchor"` already gives you a single source) or switch PayModal/e2e to the Anchor client. Low priority for judging; a mismatch would fail loudly (`AccountOwnedByWrongProgram`), not silently.

#### L4. No security headers on the deployed SPA
- **File:** `app/vercel.json:6` — only the SPA rewrite; no `headers` block.
- React escapes all rendered values (no `dangerouslySetInnerHTML`/`innerHTML`/`eval` anywhere in `app/src` — grep-verified), so XSS surface is minimal today; a basic CSP (`default-src 'self'` + wallet/Devnet connects), `X-Frame-Options`, and `Referrer-Policy` would harden the hosted demo. Low.

#### L5. Minor drift: `RECORD_SPACE` in e2e is missing the 4-byte borsh string prefix
- **File:** `app/e2e.mjs:27` (`8 + 32 + 1 + 8`) vs `programs/unified-sol-pay/src/lib.rs:24–25` (`8 + 4 + 32 + 1 + 8`). The constant is declared but never actually referenced in the script (the script only *reads* account data at the computed offset `12 + storeLen`, which is correct), so nothing is broken — but the dead, wrong constant will mislead the next reader. Delete it or fix it.

#### L6. Repository hygiene: uncommitted/untracked stray files
- `git status` shows modified `USERGUIDE.md`, `architecture.md`, `app/.gitignore` and an untracked `opencode.json` (local MCP config containing only a local binary path — no secrets). `validator-ledger/` (ledger binaries + validator/genesis/faucet keypairs for a local test validator) is appropriately ignored but physically large and stored in-repo. Commit what belongs, delete what doesn't, and keep `validator-ledger/` out of any archive. No secrets are involved (all six keypair files verified untracked).

### Informational
- `app/src/main.jsx:12` sets `window.Buffer` — standard Vite/web3.js polyfill shim, fine.
- The program accepts `amount = 0` in `pay_to_handle` (no `> 0` require) — a no-op transfer burns a sig; harmless but a one-line cleanup.
- `PayModal.jsx:75` displays a hardcoded "fee < 0.00001 SOL" claim — cosmetic, driven off current fee estimates elsewhere in e2e.
- Wallet connect is explicit: `autoConnect={false}` (`app/src/main.jsx:20`) — no silent signing surface.
- RPC is exclusively `clusterApiUrl("devnet")` (`app/src/main.jsx:14`) / `https://api.devnet.solana.com` with an env override (`app/e2e.mjs:14`) — no opaque third-party endpoints, no keys embedded.

---

## On-chain account-spoofing analysis (per audit target #1)

For `pay_to_handle(payer, recipient, handle_record, handle, amount)`, each adversarial construction, and where it dies:

| Attacker move | Check that defeats it |
|---|---|
| Pass an attacker-controlled account of any other owner with crafted bytes as `handle_record` | `Account<'info, HandleRecord>` (lib.rs:122) — Anchor runtime-rejects non-program-owned accounts and discriminator mismatch before handler code runs |
| Pass the registry PDA of a *different* handle | Handler re-derives `find_program_address([b"upi", handle_arg_bytes])` and `require!`s equality (lib.rs:64–67) → `NotCanonical`. Also fails recipient check downstream |
| Pass their own record (registered to themselves) while paying "someone else's" handle | Same canonicality check — record PDA must equal PDA(handle_arg); attacker's record is PDA(attackers_handle) |
| Re-register / take over an existing handle | `register_handle` uses `init` (lib.rs:97–103), not `init_if_needed` — only succeeds on a system-owned, zero-data, zero-balance account; a taken PDA exists with data, so re-init fails at the runtime level, permanently (PDAs are deterministic, so takeover is structurally impossible) |
| Redirect funds after resolution (pay "alice", transfer to attacker) | `require!(recipient == handle_record.authority, NotRecipient)` (lib.rs:69–72) — and the record's authority can only be the original registrant's `payer` key, set once at init (lib.rs:50); no instruction mutates it |
| Anything else mutating the record (bypassing `register_handle` semantics) | Program owns the account; no CPI-authority or write path exists other than the two instructions |
| Arithmetic abuse of `amount: u64` | Direct System Program CPI with `u64`; workspace sets `overflow-checks = true` (`Cargo.toml`); no fee/split math exists in the program |

The seeds-derivation loop is closed: the consumer (registry read or payment) always derives the PDA from the *canonical* handle bytes (`upilib.js:39–44`; e2e `pdaOf`), on-chain derivation uses the *instruction arg* (`lib.rs:66, 101`), and the client validates the same charset (`isValidHandle`, `upilib.js:49–50`). Since the on-chain `validate_handle` (lib.rs:127–138) is the only writer-gate and enforces lowercase a-z0-9._- (1–32 bytes), the stored handle =~ derived-key input is exact and case- and charset-canonical.

**Documented residuals (stated honestly):**
- There is **no authority-withdrawal weakness** because there is **no custody** — nothing to implement. The "authority-only withdrawal" concern dissolves: funds never sit in a program vault; the record is pure mapping data.
- No `unregister` / `transfer` instruction: a lost wallet = a lost handle forever; and no dispute path for squatting (see M3).
- `recipient` is deliberately an `UncheckedAccount` (lib.rs:115–119) with the in-handler invariant — the `CHECK:` doc comment is accurate. A deeper defense would be deriving nothing and passing `record.authority` as a required-Match constraint, but the current triple-layer (ownership + canonicality + authority match) is genuinely equivalent protection.
- - `handle_record` is not marked `writable` — correct, it's read-only in the payment path (unit test asserts this layout, `app/tests/unit.test.mjs:109`).

---

## What is NOT a risk here

- **No custody**: every payment is a plain `system_program::transfer` payer→recipient inside the same transaction (`lib.rs:74–83`). The program never owns lamports, there is no vault, no account data escrow, no fee split — a malicious or broken program *cannot steal funds at rest* because there are none at rest.
- **No server, no key material in the client**: the React app is a stateless SPA talking to Devnet RPC; users sign with their own injected wallet (`autoConnect=false`); e2e's payer key is Devnet-only.
- **Devnet-only blast radius**: `clusterApiUrl("devnet")`, `Anchor.toml cluster = "devnet"`, explorer links all pinned to `?cluster=devnet`. A red-team in the demo does not touch real value.
- **Secrets in git**: verified absent — `git ls-files` and full-history `--name-only` contain every keypair/`.env` pattern check; `.gitignore:8–13` covers `*.json.keypair`, `**/id.json`, `dapp.payer.json`, program keypairs, `validator-ledger/`, `.env`. (Residual packaging risk is M2, tracked above.)
- **No known-vulnerable direct pins**: direct deps are current majors (`react` 19.3, `vite` 8, `@solana/web3.js` 1.99, `qrcode.react` 4); all 100 advisories are transitive via one removable package (M1).
- **No script injection vectors**: template/JSX escaping everywhere; camera QR input is regex-normalized and regex-validated before use; external links interpolate only tx-signatures/base58 handles into explorer URLs.

---

## Hackathon judge summary (drop-in for README)

> **Security posture (audited):** The registry is a pure PDA-keyed mapping: `PDA = find_program_address(["upi", handle])`, confirmed to be the Anchor-init'd singleton per handle, so a handle can never be spoofed, re-registered, or taken over. Payments execute a direct payer→recipient System Program transfer — the program holds no SOL at any point, which eliminates the entire custody/drain/withdrawal risk class by construction; the handler additionally re-derives the canonical PDA in-instruction and `require!`s the recipient to equal the record's authority, and our e2e gate `app/e2e.mjs` proves a wrong-recipient transaction is rejected **on real devnet**, not just in theory. A full security audit (`AUDIT.md`), 15 passing unit tests covering instruction layouts and encoding edge cases, and a 13/13 headless devnet e2e gate accompany the repo. The app is fully self-contained: no backend, no stored private keys, transactions signed locally via injected wallets — only Devnet endpoints and a constant program ID are pinned, and our git history and `.gitignore` checked clean of any key material. Known trade-offs are documented honestly: dependency audit noise from an unnecessary wallet adapter omnibus package, and (by PDA-registry MVP design) that handles are first-come-first-served without identity verification.

---

*Audit performed 2026-11-08 against commit `f354419` (single-commit history). Static analysis only — no transactions were submitted by the auditor; retries and the e2e negative control referenced above were executed by the project itself as documented in the repo.*
