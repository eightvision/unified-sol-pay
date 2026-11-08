import { useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  normalizeHandle, isValidHandle, handlePda, resolveHandle,
  registerHandleTx,
} from "./upilib";

export function Home({ onPay, refreshTick, onLedgerWrite }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [handle, setHandle] = useState("");
  const [checked, setChecked] = useState({ state: "idle" }); // idle|invalid|taken|free|yours
  const [balance, setBalance] = useState(null);
  const [mine, setMine] = useState(null); // my registered handle record
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null); // {kind, text}
  const toastTimer = useRef(null);

  const say = (kind, text, ms = 2600) => {
    setToast({ kind, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const myKey = publicKey?.toBase58() ?? null;

  // Remember my VPA across refreshes: localStorage cache, verified against the
  // ledger on every load — the chain stays the single source of truth.
  useEffect(() => {
    if (!myKey) { setMine(null); return; }
    const cached = localStorage.getItem(`solpay.handle:${myKey}`);
    if (!cached) return;
    (async () => {
      try {
        const r = await resolveHandle(connection, cached);
        if (r?.wallet && r.wallet.toBase58() === myKey) {
          setMine(cached); // verified live → keep
          return;
        }
        // stale cache (different owner / gone) → drop it, don't fake ownership
        localStorage.removeItem(`solpay.handle:${myKey}`);
      } catch { /* transient RPC error — cache stays, will re-verify next load */ }
    })();
  }, [myKey, connection]);

  useEffect(() => {
    if (!publicKey) { setBalance(null); setMine(null); return; }
    let alive = true;
    (async () => {
      setBalance(await connection.getBalance(publicKey));
    })();
    return () => { alive = false; };
  }, [publicKey, connection, refreshTick, toast?.kind]); // refresh after register + after any ledger write

  // live availability check with 400ms debounce
  useEffect(() => {
    const h = normalizeHandle(handle);
    if (!h) { setChecked({ state: "idle" }); return; }
    if (!isValidHandle(h)) { setChecked({ state: "invalid", h }); return; }
    if (!publicKey) { setChecked({ state: "free", h }); return; }
    const t = setTimeout(async () => {
      try {
        const pda = handlePda(h);
        const existing = await resolveHandle(connection, h);
        if (existing?.wallet) {
          if (existing.wallet.equals(publicKey)) {
            localStorage.setItem(`solpay.handle:${publicKey.toBase58()}`, h);
            setMine((m) => m ?? h);
            setChecked({ state: "yours", h });
          } else {
            setChecked({ state: "taken", h });
          }
        } else {
          setChecked({ state: "free", h });
        }
      } catch { setChecked({ state: "free", h }); }
    }, 400);
    return () => clearTimeout(t);
  }, [handle, publicKey, connection]);

  const showDevnet = () => {
    const b = balance == null ? null : balance / LAMPORTS_PER_SOL;
    return b == null ? "—" : `${b.toFixed(4)} SOL`;
  };

  async function registerNow() {
    const h = checked.h;
    if (!publicKey) return say("info", "Connect your wallet first");
    if (!h || !isValidHandle(h)) return say("err", "Enter a valid handle (a-z 0-9 . _ -)");
    if (checked.state !== "free" && checked.state !== "yours") return;
    setBusy(true);
    try {
      const pda = handlePda(h);
      const pre = await connection.getAccountInfo(pda);
      if (pre) { // already exists and is theirs
        setMine(h);
        localStorage.setItem(`solpay.handle:${publicKey.toBase58()}`, h);
        say("ok", `You already own ${h}@solpay ✓`);
        return;
      }
      const tx = registerHandleTx(publicKey, h);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      const res = await connection.confirmTransaction(sig, "confirmed");
      if (res.value.err) throw new Error("Transaction failed on-chain");
      setMine(h);
      localStorage.setItem(`solpay.handle:${publicKey.toBase58()}`, h);
      setChecked({ state: "yours", h });
      say("ok", `${h}@solpay created on Solana ✓`, 4200);
      onLedgerWrite?.(); // passbook/balance elsewhere re-read the ledger
    } catch (e) {
      say("err", String(e.message || e).slice(0, 120), 4200);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="muted">Devnet balance</div>
        <div className="balance" style={{ marginTop: 6 }}>◎ {showDevnet()}</div>
      </div>

      <div className="card">
        <b>Your UPI-style handle</b>
        <p className="muted" style={{ margin: "4px 0 10px" }}>
          Register a memorable VPA-like address on-chain — money arrives at your wallet.
        </p>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="handle-input"
            placeholder="yourname"
            value={handle}
            disabled={!publicKey || !!mine}
            onChange={(e) => setHandle(e.target.value)}
            spellCheck={false}
          />
          {!mine && (
            <button className="tile primary" style={{ padding: "12px 18px", borderRadius: 8 }}
              disabled={busy || checked.state !== "free"}
              onClick={registerNow}>
              {busy ? "Signing…" : "Create"}
            </button>
          )}
        </div>
        {handle.trim() !== "" && (
          <div className="handle-preview">
            →&nbsp;<b>{normalizeHandle(handle) || "?"}</b>
            <span className="tld">@solpay</span>
            {checked.state === "invalid" && <span> · <span style={{ color: "var(--danger)" }}>only a-z 0-9 . _ - (max 32)</span></span>}
            {checked.state === "taken" && <span> · <span style={{ color: "var(--danger)" }}>already claimed</span></span>}
            {checked.state === "free" && <span> · <span className="ok">available ✓</span></span>}
            {checked.state === "yours" && (
              <span>
                · <span className="ok">yours ✓</span>{" "}
                <a className="explorer" target="_blank" rel="noreferrer"
                  href={`https://explorer.solana.com/address/${handlePda(checked.h)?.toBase58()}?cluster=devnet`}>
                  view on explorer
                </a>
              </span>
            )}
          </div>
        )}
        {!publicKey && <p className="muted" style={{ marginBottom: 0 }}>connect a Phantom / Solflare wallet to register</p>}
        {mine && (
          <p style={{ margin: "10px 0 0" }}>
            <span className="handle-preview ok" style={{ display: "inline" }}>✓ {mine}@solpay is live</span>
          </p>
        )}
      </div>

      {toast && <div className={`toast ${toast.kind}`}>{toast.text}</div>}
    </>
  );
}
