import { useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { QRCodeSVG } from "qrcode.react";
import { solpayUrl, resolveHandle, normalizeHandle, isValidHandle } from "./upilib";

/**
 * My-QR tab.
 * - "show": my personal Solana Pay QR.
 * - "scan": camera scan when BarcodeDetector is available; paste-input always works.
 * A resolved handle offers a one-tap "Pay" that opens the pay sheet prefilled.
 */
export function QRTab({ onPay }) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [mode, setMode] = useState("show");
  const [text, setText] = useState("");
  const [who, setWho] = useState(null); // {handle, wallet}
  const [camStatus, setCamStatus] = useState("");
  const streamRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (mode !== "scan") {
      setCamStatus("");
      setWho(null);
      setText("");
      return;
    }
    let stop = false;
    setCamStatus("starting camera…");
    (async () => {
      if (!("BarcodeDetector" in window)) {
        setCamStatus("this browser can't scan QR — paste a handle instead");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stop) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCamStatus("point the camera at a Sol Pay QR…");
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const tick = async () => {
          if (stop) return;
          try {
            const codes = await detector.detect(videoRef.current || stream);
            if (codes.length) {
              setText(normalizeHandle(codes[0].rawValue.replace("solana:", "")));
              setCamStatus("");
              return;
            }
          } catch { /* frame race */ }
          setTimeout(tick, 250);
        };
        setTimeout(tick, 350);
      } catch (e) {
        setCamStatus("camera unavailable — paste a handle instead (" + (e.message || e) + ")");
      }
    })();
    return () => {
      stop = true;
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    };
  }, [mode]);

  // resolve handle → wallet (registry read)
  useEffect(() => {
    setWho(null);
    if (!isValidHandle(text)) return;
    let alive = true;
    (async () => {
      const r = await resolveHandle(connection, text);
      if (alive) setWho({ handle: text, wallet: r.wallet });
    })();
    return () => { alive = false; };
  }, [text, connection]);

  if (!publicKey) return (
    <div className="card"><p className="muted" style={{ margin: 0 }}>connect a wallet to use QR features.</p></div>
  );

  const s = publicKey.toBase58();
  const url = solpayUrl(s, { label: "Unified Sol PayApp" });

  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div className="row" style={{ justifyContent: "center", gap: 8, marginTop: 4, marginBottom: 12 }}>
        <button className={`tile ${mode === "show" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("show")}>My QR</button>
        <button className={`tile ${mode === "scan" ? "primary" : "ghost"}`} style={{ flex: 1 }} onClick={() => setMode("scan")}>Scan & Pay</button>
      </div>

      {mode === "show" ? (
        <>
          <div style={{ background: "#fff", borderRadius: 14, padding: 14, display: "inline-block" }}>
            <QRCodeSVG value={url} size={220} level="M" />
          </div>
          <p className="muted" style={{ marginTop: 10, wordBreak: "break-all" }}>
            {s.slice(0, 10)}…{s.slice(-8)} — your Solana Pay QR
          </p>
        </>
      ) : (
        <>
          <div style={{ background: "var(--mist)", borderRadius: 14, overflow: "hidden" }}>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />
          </div>
          {camStatus && <p className="muted" style={{ marginTop: 8 }}>{camStatus}</p>}
          {who?.wallet && <ScanConnector {...who} onPay={onPay} />}
        </>
      )}

      <div style={{ marginTop: 12 }}>
        <input className="input" placeholder="…or paste someone's handle" spellCheck={false}
          value={isValidHandle(text) ? text : ""}
          onChange={(e) => {
            setText(normalizeHandle(e.target.value));
          }} />
        {text && !isValidHandle(text) && <p className="muted" style={{ color: "var(--danger)", textAlign: "left" }}>handles use a-z 0-9 . _ - only</p>}
      </div>
    </div>
  );
}

function ScanConnector({ handle, wallet, onPay }) {
  return (
    <div className="card row" style={{ marginTop: 10, textAlign: "left" }}>
      <div className="avatar">{handle[0].toUpperCase()}</div>
      <div style={{ flex: 1 }}>
        <b>{handle}@solpay</b>
        <div className="muted">{wallet ? "resolved from the registry ✓" : "not registered on-chain yet"}</div>
      </div>
      {wallet && (
        <button className="tile primary" style={{ padding: "8px 14px" }} onClick={() => onPay?.(handle)}>
          Pay
        </button>
      )}
    </div>
  );
}
