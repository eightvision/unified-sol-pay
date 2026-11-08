import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PROGRAM_ID } from "./upilib";

/** Real passbook: signature history straight off the devnet ledger */
export function Passbook() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [rows, setRows] = useState(undefined); // undefined = loading

  useEffect(() => {
    if (!publicKey) { setRows(null); return; }
    let alive = true;
    (async () => {
      setRows(undefined);
      const sigs = await connection.getSignaturesForAddress(publicKey, { limit: 20 }, "confirmed");
      const detailed = await Promise.all(sigs
        .filter((s) => !s.err)
        .slice(0, 12)
        .map(async (s) => {
          try {
            const t = await connection.getTransaction(s.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
            return t ? row(s, t, publicKey) : null;
          } catch { return null; }
        }));
      if (alive) setRows(detailed.filter(Boolean));
    })();
    return () => { alive = false; };
  }, [publicKey, connection]);

  if (rows === null) return (
    <div className="card"><p className="muted" style={{ margin: 0 }}>connect a wallet to see your passbook.</p></div>
  );
  if (rows === undefined) return (
    <div className="card"><p className="muted">fetching from the Solana devnet ledger…</p></div>
  );
  if (!rows.length) return (
    <div className="card"><p className="muted" style={{ margin: 0 }}>no transactions yet — the first payment will show here.</p></div>
  );

  return (
    <div className="card">
      <b>Passbook</b>
      <p className="muted" style={{ margin: "2px 0 8px" }}>
        straight from the devnet ledger — every line is a signed on-chain transaction.
      </p>
      {rows.map((r) => <TxRow key={r.sig} {...r} />)}
    </div>
  );
}

function row(s, t, me) {
  const msg = t.transaction.message;
  const payer = msg.accountKeys[0]; // PublicKey in web3.js v1 confirmed responses
  const pre = t.meta?.preBalances?.[0];
  const post = t.meta?.postBalances?.[0];
  const delta = pre != null && post != null ? post - pre : null;
  const isProgram = msg.instructions.some((i) => String(i.programId) === PROGRAM_ID.toBase58());
  return {
    sig: s.signature,
    when: s.blockTime ? new Date(s.blockTime * 1000) : null,
    didSend: String(payer) === String(me),
    lamports: delta == null ? null : Math.abs(delta),
    isProgram,
  };
}

function TxRow({ sig, when, didSend, lamports, isProgram }) {
  const incoming = !didSend;
  return (
    <div className="tx-row">
      <div className="avatar" style={{
        width: 36, height: 36, fontSize: 14,
        background: isProgram ? "linear-gradient(135deg, var(--sol-purple), var(--upi-orange))" : "var(--money-green)",
      }}>
        {isProgram ? "⚡" : incoming ? "↓" : "↑"}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {isProgram ? "Unified Sol Pay tx" : incoming ? "Received SOL" : "Sent SOL"}
        </div>
        <div className="tx-time">{when ? when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</div>
        <a className="explorer" target="_blank" rel="noreferrer"
          href={`https://explorer.solana.com/tx/${sig}?cluster=devnet`}>
          {sig.slice(0, 14)}… on explorer ↗
        </a>
      </div>
      <div className="tx-amt">
        {lamports != null && (
          <div className={incoming ? "in" : "out"}>{incoming ? "+" : "−"} ◎ {(lamports / LAMPORTS_PER_SOL).toFixed(5)}</div>
        )}
        <div className="tx-time">confirmed</div>
      </div>
    </div>
  );
}
