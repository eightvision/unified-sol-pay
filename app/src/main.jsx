import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./index.css";
import { App } from "./App.jsx";
import { Buffer } from "buffer";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { UnsafeBurnerWalletAdapter } from "@solana/wallet-adapter-unsafe-burner";
import { PersistentBurnerWalletAdapter } from "./burner.js";
import { ConnectionProvider, useWallet, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

window.Buffer = window.Buffer || Buffer; // web3.js on Vite expects a global Buffer

const endpoint = import.meta.env.VITE_RPC_URL ?? clusterApiUrl("devnet");
const BURNER = import.meta.env.VITE_BURNER === "1"; // dev-only: in-memory throwaway wallet

/**
 * Dev-only helper: top up a burner/dev wallet from the local test-validator faucet
 * so register/pay can be tested with zero setup. Never runs in production builds.
 */
import { useRef } from "react";
function BurnerAutoConnect() {
  const { wallets, select, connect, wallet, publicKey } = useWallet();
  useEffect(() => {
    if (!BURNER || publicKey || !wallets.length) return;
    const burner = wallets.find((w) => w.adapter.name.toLowerCase().includes("burner"));
    if (burner && (!wallet || wallet.adapter.name !== burner.adapter.name)) select(burner.adapter.name);
  }, [wallets, publicKey]);
  useEffect(() => {
    if (!BURNER || !wallet || publicKey) return;
    const t = setTimeout(() => { connect().catch((e) => console.error("auto connect:", e)); }, 80);
    return () => clearTimeout(t);
  }, [wallet, publicKey]);
  return null;
}

/** Dev-only manual fallback: click to select+connect the burner, alert() either way. */
function BurnerButton() {
  const { select, connect, publicKey } = useWallet();
  const busy = useRef(false);
  const go = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      select("Burner Wallet");
      await new Promise((r) => setTimeout(r, 80)); // let the provider commit the selection
      await connect();
      window.alert("Burner connected ✅ — header should now show a wallet address.");
    } catch (e) {
      console.error("burner connect failed:", e);
      window.alert("Burner connect failed: " + (e?.name ?? "") + " " + (e?.message ?? String(e)));
    } finally {
      busy.current = false;
    }
  };
  if (publicKey) return null;
  return (
    <button
      onClick={go}
      style={{ position: "fixed", bottom: 64, left: 8, zIndex: 9999, fontSize: 12, opacity: 0.85 }}
    >
      🧪 Use test wallet
    </button>
  );
}

function FaucetTopUp() {
  const { publicKey, connecting } = useWallet();
  useEffect(() => {
    if (!publicKey || connecting) return;
    if (!BURNER) return;
    let cancelled = false;
    const c = new Connection(endpoint, "confirmed");
    c.getBalance(publicKey)
      .then(async (bal) => {
        if (cancelled || bal >= 0.2 * LAMPORTS_PER_SOL) return;
        try { await c.requestAirdrop(publicKey, LAMPORTS_PER_SOL); } catch { /* rate limited */ }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [publicKey]);
  return null;
}

const wallets = BURNER ? [new PersistentBurnerWalletAdapter(), new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: "devnet" })] : [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: "devnet" })];

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={BURNER}>
        <WalletModalProvider>
          {BURNER && <BurnerAutoConnect />}
          {BURNER && <BurnerButton />}
          {BURNER && <FaucetTopUp />}
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>
);
