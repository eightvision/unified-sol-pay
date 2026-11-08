/**
 * Devnet integration test runner — after implementation gate.
 * Wraps e2e.mjs (the actual devnet flow) and asserts its verdict.
 *   node tests/devnet.test.mjs            — runs against deployed program
 * Requires: devnet wallet funded (see implementation.md) + deployed program.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const handle = process.argv[2] ?? "";

if (!fs.existsSync(path.join(appDir, "dapp.payer.json"))) {
  console.log("SKIP: no dapp.payer.json — create + fund a devnet wallet first (implementation.md §1)");
  process.exit(0);
}

const res = spawnSync("node", [path.join(appDir, "e2e.mjs"), handle], {
  cwd: appDir,
  encoding: "utf8",
  timeout: 480_000,
  env: { ...process.env, FORCE_COLOR: "0" },
});

process.stdout.write(res.stdout ?? "");
if (res.stderr) process.stderr.write(res.stderr);

const out = res.stdout ?? "";
const passCount = (out.match(/✅/g) ?? []).length;
const failCount = (out.match(/❌/g) ?? []).length;
const verdict = out.includes("E2E PASS");

console.log(`\nintegration summary: ${passCount} checks passed, ${failCount} failed, verdict ${verdict ? "PASS" : "FAIL"}`);
if (!verdict || failCount > 0) {
  console.log("TROUBLESHOOTING:");
  console.log("• 'AccountNotInitialized / custom program error' → program deployed? (solana program show + lib.rs declare_id match)");
  console.log("• 'ratelimited/no airdrop' → use https://faucet.devnet.solana.com in a browser with the address. See plan.md risk register.");
  console.log("• 'failed to send transaction' → RPC flake; re-run once before debugging.");
}
process.exit(verdict && failCount === 0 ? 0 : 1);
