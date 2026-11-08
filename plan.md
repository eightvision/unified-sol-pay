# Plan — Unified Sol PayApp

**Mission:** Ship a working UPI-style payments app on Solana devnet for the MLH Solana Hackathon (DeFi Track). Judges reward *working products that use Solana for what it's good at* — speed, low fees, on-chain ownership. Not a mockup, not web2-with-a-chain-bolted-on.

## Pitch in one line
> UPI taught India to pay with a name. We put that same handle-based, instant, near-free payment experience on Solana's rails — with an actual on-chain handle registry program.

## Scope decided (owner-confirmed)
| Decision | Value |
|---|---|
| MVP feature set | **Core trio**: handle registration, pay-by-handle, Scan-&-Pay (QR) + transaction history |
| Handle registry | **On-chain Anchor program** (handle → wallet PDA mapping), deployed to **devnet** |
| Currency / network | **Devnet SOL** only; no mainnet, no real funds |
| Track | **DeFi Track** (auto-enters Top 3 Overall) |
| Artifacts from agent | Deployed live URL, public repo, README, step-by-step demo script (`DEMO.md`) |
| Artifacts from user | Demo video recording + MLH Challenges submission |
| Deadline | Hand off to user by **~9:00 PM IST**; final MLH submission **10:15 PM IST** |
| Sandbox | All project artifacts inside `/Users/pranav/Documents/Unified_Sol_PayApp`; tool installs only via sanctioned installers; nothing else touched |

## Strategy (fastest path to verified MVP)
1. **Toolchain** — install Rust + Solana CLI + Anchor via official installer (one command; removed once and reinstallable via `implementation.md`).
2. **On-chain program first** — handle registry + pay-to-handle routing is the SouLa-judge differentiator; UI without it is a mockup.
3. **Client/e2e script before UI polish** — headless verification that register → pay-by-handle works on devnet using two CLI keypairs. This proves the MVP without any UI risk.
4. **UI second** — UPI-toned design system (see `design-system.md`); the four flows: Connect/Register, Pay by handle, My QR / Scan, Passbook.
5. **Deploy + verify the deployed build** — same e2e against a live URL; record-ready demo script for the user.
6. **Handoff** — stop at 9:00 PM IST even if some polish is pending.

## Not in scope (explicit)
Autopay / standing instructions, collect-request invoices, stablecoin (USDC/INR) support, mainnet, mobile native apps — all listed in README as "natural next steps" for the pitch.

## Known risk register
| Risk | Mitigation / evidence needed |
|---|---|
| Devnet faucet rate-limit / DNS (observed once: `faucet.devnet.solana.com` failed DNS; CLI airdrop rate-limited) | Slow retry loop; alternate RPC; Surfpool local fallback for judging demo script note |
| Anchor ↔ Solana CLI version mismatch | Pin anchor-lang exactly to CLI's anchor-cli version; overflow-checks in workspace profile |
| Deploy hosting needs user creds | Ask user for Vercel token/board, else stop-and-report per Goal |
| Web3.js v1 vs v3 peer conflicts | Pinned web3.js ^1.99 + wallet-adapter line (mature, judge-familiar) |
