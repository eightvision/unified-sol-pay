# 🎬 Demo script (~90 seconds, record screen to file, 1440p if possible)

**Prep before recording:**
- [ ] Two tabs/windows of the app open (or one tab + a second browser profile).
- [ ] Wallet A ("you") has devnet SOL; Wallet B ("friend") is registered with handle `friend@solpay`.
- [ ] Devnet cluster selected everywhere.

## Shot list

1. **(0–10s) Hook.** Full-screen the app home. Say: *"You know UPI. Instant payments with just a handle — no bank addresses. This is the same idea, on Solana."*

2. **(10–25s) Register.** Click **Register handle**, connect wallet, type `pranav@solpay`, sign. Point out: *"That signature wrote the handle→wallet mapping onto the Solana ledger."* (Show the tx link on Solana Explorer if time — it proves it's real.)

3. **(25–45s) Pay by handle.** Open the second tab (different wallet), click **Pay**, type `pranav@solpay` and an amount of `0.01`. Show the resolved recipient name/wallet, confirm, then the success state. Say: *"That's a real devnet transaction — finality in about a second, fee a fraction of a cent."*

4. **(45–60s) Scan & Pay + QR.** Click **My QR** → show QR → second wallet scans (or pastes the link) → payment request → confirm.

5. **(60–80s) Passbook.** Show **History** on both wallets — entries list real signature hashes; click one → explorer → completed tx.

6. **(80–90s) Close.** *"UPI taught a country to pay with a name. Solana's rails make it global, instant, and programmable. Unified Sol PayApp."*

---

## Recording notes
- Use OBS / QuickTime "New Screen Recording"; crop to the browser.
- Do each flow in one take; you can splice, but avoid cutting mid-transaction.
- Keep sounds off the clicks, keep the narration.
- Export ≤ 100MB; name: `unified-sol-payapp-demo.mp4`.
