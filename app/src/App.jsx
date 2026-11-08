import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  normalizeHandle, payToHandleTx,
} from "./upilib";
import { Home } from "./Home";
import { QRTab } from "./QRTab";
import { Passbook } from "./Passbook";
import { PayModal } from "./PayModal";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export function App() {
  const [tab, setTab] = useState("home");
  const [payOpen, setPayOpen] = useState(false);
  const [payPrefill, setPayPrefill] = useState(null);

  return (
    <div className="phone">
      <div className="appbar">
        <div className="brand">
          Unified <span>Sol</span> Pay<span className="tld">@solpay</span>
        </div>
        <WalletMultiButton />
      </div>

      {tab === "home" && <Home onPay={() => setPayOpen(true)} />}
      {tab === "qr" && <QRTab onPay={(h) => { setPayPrefill("h:" + h); setPayOpen(true); }} />}
      {tab === "passbook" && <Passbook />}

      <div className="actionbar">
        <button className="tile primary" onClick={() => { setTab("home"); setPayPrefill(null); setPayOpen(true); }}>Pay</button>
        <button className="tile ghost" onClick={() => setTab("qr")}>My QR</button>
        <button className="tile ghost" data-active={tab === "passbook"} onClick={() => setTab("passbook")}>Passbook</button>
      </div>

      {payOpen && <PayModal prefill={payPrefill} onClose={() => setPayOpen(false)} />}
    </div>
  );
}
