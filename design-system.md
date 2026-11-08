# Design System — Unified Sol PayApp

**Design intent:** feel instantly familiar to a billion UPI users — *but clearly on Solana*. The trick is mimic the choreography (big one-tap actions, a friendly "payee card," green success states) while the Solana-native scarce signals (explorer links, sub-penny fee, second-level finality) read as *better than what users expect*.

## Palette
| Token | Hex | Use |
|---|---|---|
| `--upi-orange` | `#F97316` | Primary action (UPI-style send/enter) |
| `--upi-money-green` | `#16A34A` | Balance, success, confirmed tx |
| `--ink` | `#111827` | Text |
| `--slate` | `#6B7280` | Secondary text |
| `--mist` | `#F3F4F6` | Cards, dividers |
| `--sol-purple` | `#9945FF` | Solana presence only (logo, wallet chips, link icons) |
| `--sol-teal` | `#14F195` | Gradient accent with purple — NOT standalone |
| `--danger` | `#DC2626` | Failed tx |

**Rule:** UPI-orange owns actions; Solana-purple is never used for a button — presence without domination.

## Typography
- `Inter` (system fallback `-apple-system, Roboto, sans-serif`) — crisp, hackathon-judge-legible at 16/24.
- Handle rendering: monospaced short tag styled `pranav@` **`solpay`** where suffix purple.
- Big money: `tabular-nums`, weight 700, sized `.5em`-incremental bar.

## Spacing & shape
- Root radius: 16px cards, 8px inputs; generous 8px-based rhythm.
- Cards over `--mist` white; single shadow level (`0 1px 2px rgba(0,0,0,.06)`) — keep flat UPI look.
- Phone-shaped success screens: even on desktop, registration success + confirmed-tx screens are *modal look, single centered card*.

## Components (the 6 that exist)
1. **BottomNav / 3-tab root** — Home, QR, Passbook.
2. **PayeeCard** — sender preview: `friend@solpay` avatar circle (initial letter), resolved wallet cut off `DXUt…MBnz`. *The most UPI-feeling component in the app — invest here.*
3. **Numpad** — the ©-UPI rupee-style amount pad, confirm bar never moves while editing.
4. **ActionTile** — big primary Send (orange), My-QR (outlined).
5. **TxRow** — passbook entry: avatar, ± lamports in green/danger, tiny signed-bundle `Minutes ago`, purple explorer link.
6. **Toast** — the UPI green "Payment sent ✓" full-width bar, NOT a small corner snackbar.

## Motion
≤150ms, ease-out only:
- **tap**: tile scale 0.98 on active
- **confirm**: button slides to a solid green-spinner-once (classic UPI "processing" cue)
- **success**: paid modal rises as done — never a confetti library.

## Microcopy rules
- "Pay ₹"-style amounts always shown with lamports-equivalent in small text.
- Errors: plain text "Handle not registered" beats API gibberish; explorer link on failures.
- "sign" → word even in copy: "signing…", "sent ✓", confirms.
- Fee line always visible before confirm: *Est. fee ~$0.00002 — Solana*.

## Explicit non-designs
- No dark-premium crypto-cyberpunk typography or generative-NFT flattery.
- No splash airdrop animations blocking interaction.
- Stock success ≠ handing UX over vanity — the explorer link is the hero of the success state.
