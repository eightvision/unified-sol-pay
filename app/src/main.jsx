import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./index.css";
import { App } from "./App.jsx";
import { Buffer } from "buffer";
import { clusterApiUrl } from "@solana/web3.js";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";

window.Buffer = window.Buffer || Buffer; // web3.js on Vite expects a global Buffer

const endpoint = clusterApiUrl("devnet");
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: "devnet" })];

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect={false}>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  </StrictMode>
);
