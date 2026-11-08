// Dev-only persistent burner wallet: keypair stored in localStorage so the same
// test wallet survives refreshes. Never active in production (only VITE_BURNER=1).
import { UnsafeBurnerWalletAdapter } from "@solana/wallet-adapter-unsafe-burner";
import { Keypair } from "@solana/web3.js";

const KEY = "solpay.burner.keypair"; // dev-only, never set in production builds

export class PersistentBurnerWalletAdapter extends UnsafeBurnerWalletAdapter {
  name = "Burner Wallet";
  async connect() {
    if (!this._keypair) {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || "null");
        if (raw) this._keypair = Keypair.fromSecretKey(Uint8Array.from(raw));
      } catch {
        localStorage.removeItem(KEY);
      }
      if (!this._keypair) {
        this._keypair = new Keypair();
        localStorage.setItem(KEY, JSON.stringify(Array.from(this._keypair.secretKey)));
      }
    }
    this.emit("connect", this._keypair.publicKey);
  }
  async disconnect() {
    this._keypair = null;
    this.emit("disconnect");
  }
}
