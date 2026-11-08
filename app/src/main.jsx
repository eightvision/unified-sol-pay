import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./index.css";
import { App } from "./App.jsx";
import { Buffer } from "buffer";
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { UnsafeBurnerWalletAdapter } from "@solana/wallet-adapter-unsafe-burner";
import { ConnectionProvider, useWallet, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

window.Buffer = window.Buffer || Buffer; // web3.js on Vite expects a global Buffer

const endpoint = import.meta.env.VITE_RPC_URL ?? clusterApiUrl("devnet");
const BURNER = import.meta.env.VITE_BURNER === "1"; // dev-only: in-memory throwaway wallet

/**
 * Dev-only helper: top up a burner/dev wallet from the local test-validator faucet
 * so register/pay can be tested with zero setup. Never runs in production builds.
 */
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

const wallets = BURNER ? [new UnsafeBurnerWalletAdapter(), new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: "devnet" })] : [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: "devnet" })];

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          {BURNER && <FaucetTopUp />}
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>
);
