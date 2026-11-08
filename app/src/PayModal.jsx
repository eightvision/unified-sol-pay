import { useEffect, useState, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import {
  normalizeHandle, isValidHandle, handlePda, resolveHandle, payToHandleTx,
} from "./upilib";

/** UPI-style pay sheet: handle → payee card → numeric pad → sign → success modal */
export function PayModal({ prefill, onClose, onLedgerWrite }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();
  const [handle, setHandle] = useState(prefill ? normalizeHandle(prefill.replace(/^h:/, "")) : "");
  const [payee, setPayee] = useState(prefill ? null : null);
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState("input"); // input | signing | done | error
  const [sig, setSig] = useState(null);
  const [err, setErr] = useState("");
  const debounce = useRef(null);

  const h = normalizeHandle(handle);

  // live resolution (debounced 350ms) — payee is cleared on every keystroke so
  // Send can never sign with a recipient from an older handle (not-recipient 0x1773).
  useEffect(() => {
    clearTimeout(debounce.current);
    setPayee(null); // no stale recipient can survive a handle edit
    if (!isValidHandle(h)) return;
    debounce.current = setTimeout(async () => {
      try {
        const r = await resolveHandle(connection, h);
        setPayee(r.wallet ?? "notfound");
      } catch { setPayee("notfound"); }
    }, 350);
    return () => clearTimeout(debounce.current);
  }, [h, connection]);

  const lamports = Math.round(parseFloat(amount || "0") * LAMPORTS_PER_SOL);
  const valid = isValidHandle(h) && payee && payee !== "notfound" && lamports > 1000 && publicKey;

  async function confirm() {
    if (!valid || stage === "signing") return;
    setStage("signing");
    try {
      // Resolve THE LEDGER NOW — never sign with a payee resolved earlier.
      const r = await resolveHandle(connection, h);
      const payeeNow = r?.wallet ?? null;
      if (!payeeNow) throw new Error(`${h}@solpay is not registered on-chain`);
      if (payeeNow.toBase58() !== payee?.toBase58()) {
        throw new Error(`${h}@solpay moved — its owner changed since you typed. Resolved again; press Send once more.`);
      }
      const tx = payToHandleTx(publicKey, payeeNow, h, lamports);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash("finalized")).blockhash;
      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      const res = await connection.confirmTransaction(sig, "confirmed");
      if (res.value.err) throw new Error("on-chain transfer failed");
      setSig(sig);
      setStage("done");
      onLedgerWrite?.(); // balances + passbook re-read the ledger now that it changed
    } catch (e) {
      setErr(String(e.message || e).slice(0, 140));
      setStage("error");
    }
  }

  function reset() { setStage("input"); setSig(null); setErr(""); }

  return (
    <div className="modal-scrim" onClick={stage === "done" ? onClose : undefined}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {stage === "input" && (
          <>
            <h3 style={{ marginTop: 0 }}>Pay by handle</h3>
            <input
              className="handle-input" placeholder="pranav@solpay" spellCheck={false}
              autoFocus value={handle} onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9@._\-]/g, ""))}
            />
            <PayeeCard handle={isValidHandle(h) ? h : null} payee={payee} />

            <div className="amount-display">
              <span className="pre">◎</span>
              {amount || "0"}
            </div>
            <div className="fee-line">{lamports > 0 && `≈ ${(lamports / LAMPORTS_PER_SOL).toFixed(5)} SOL · fee < 0.00001 SOL`}</div>

            <div className="numpad">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, "."].map((d) => (
                <button key={String(d)} onClick={() => amtInput(String(d))}>{d}</button>
              ))}
              <button onClick={amtBack}>⌫</button>
              <button style={{ background: "var(--upi-orange)", color: "#fff" }} disabled={!valid} onClick={confirm}>
                Send {lamports > 0 && isValidHandle(h) ? `◎${amount}` : ""}
              </button>
            </div>
          </>
        )}

        {stage === "signing" && (
          <>
            <div className="big">⏳</div>
            <h3>Signing transaction…</h3>
            <p className="muted">Approve in your wallet. Solana settles in under a second.</p>
          </>
        )}

        {stage === "done" && (
          <>
            <div className="big">✅</div>
            <h3>Payment sent</h3>
            {sig && (
              <>
                <p className="muted" style={{ margin: 0 }}>{h}@solpay · ◎{amount}</p>
                <a className="explorer" target="_blank" rel="noreferrer" href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}>
                  signature {sig.slice(0, 12)}…{sig.slice(-6)} — open on explorer ↗
                </a>
              </>
            )}
            <button className="tile primary" style={{ width: "100%", marginTop: 14 }} onClick={onClose}>Done</button>
          </>
        )}

        {stage === "error" && (
          <>
            <div className="big" style={{ color: "var(--danger)" }}>⚠️</div>
            <h3>Payment didn't go through</h3>
            <p className="muted">{err}</p>
            <button className="tile primary" style={{ width: "100%", marginTop: 14 }} onClick={reset}>Try again</button>
          </>
        )}
      </div>
    </div>
  );

  function amtInput(d) {
    if (d === "." && amount.includes(".")) return;
    setAmount((a) => (a + d).slice(0, 9));
  }
  function amtBack() { setAmount((a) => a.slice(0, -1)); }
}

function PayeeCard({ handle, payee }) {
  if (!handle) return null;
  const initial = handle[0].toUpperCase();
  if (payee === "notfound") {
    return (
      <div className="card row" style={{ marginTop: 10 }}>
        <div className="avatar" style={{ background: "var(--mist)", color: "var(--slate)" }}>?</div>
        <div><b>{handle}@solpay</b><div className="muted">handle not registered on-chain</div></div>
      </div>
    );
  }
  if (payee) {
    const s = payee.toBase58();
    return (
      <div className="card row" style={{ marginTop: 10 }}>
        <div className="avatar">{initial}</div>
        <div>
          <b>{handle}@solpay</b>
          <div className="muted">wallet {s.slice(0, 4)}…{s.slice(-4)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="card row" style={{ marginTop: 10, opacity: 0.6 }}>
      <div className="muted">resolving {handle}@solpay…</div>
    </div>
  );
}
