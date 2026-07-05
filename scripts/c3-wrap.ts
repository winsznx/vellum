import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import * as fs from "fs";
import * as path from "path";

// AT#1: registry wrap/unwrap round-trip directly against the REAL wrapper pair.
// mint USDC -> approve -> wrap(USDC->cUSDT) -> userDecrypt cUSDT bal -> unwrap request ->
// publicDecrypt the unwrap amount (KMS proof) -> finalizeUnwrap -> USDC returns. Real txs throughout.
const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const WRAP = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
const ERC20 = ["function mint(address,uint256) external", "function approve(address,uint256) external returns (bool)", "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"];
const WRAPPER = [
  "function wrap(address to, uint256 amount) returns (uint256)", // returns euint64 handle (uint256 abi)
  "function unwrap(address from, address to, bytes32 amount) returns (bytes32)",
  "function finalizeUnwrap(bytes32 unwrapRequestId, uint64 unwrapAmountCleartext, bytes decryptionProof)",
  "function confidentialBalanceOf(address) view returns (bytes32)",
  "function unwrapAmount(bytes32) view returns (bytes32)",
  "function rate() view returns (uint256)",
];
const ROOT = path.join(__dirname, "..");
const STATE = path.join(ROOT, "c3-state.json");
const TRACE = path.join(ROOT, "c3-trace.log");
const OUT = path.join(ROOT, "c3-wrap.json");
const J = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
const trace = (m: string) => { const l = `[+${process.uptime().toFixed(1)}s] ${m}\n`; fs.appendFileSync(TRACE, l); process.stdout.write(l); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, n = 8): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= n; i++) { try { const r = await fn(); if (i > 1) trace(`  ${label} ok@${i}`); return r; } catch (e: any) { last = e; trace(`  ${label} ${i}/${n}: ${(e?.message ?? e).toString().slice(0, 60)}`); if (i < n) await sleep(4000 * i); } }
  throw last;
}

async function main() {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const [me] = await ethers.getSigners();
  const addr = await me.getAddress();
  await withRetry("init", () => fhevm.initializeCLIApi());
  const usdc = new ethers.Contract(USDC, ERC20, me);
  const wrap = new ethers.Contract(WRAP, WRAPPER, me);
  const out: any = { usdc: USDC, wrapper: WRAP };
  const AMT = 10_000_000n; // 10 USDC (6dp), rate=1 -> 10 cUSDT

  // mint USDC + approve
  const u0 = (await usdc.balanceOf(addr)) as bigint;
  await withRetry("mint", async () => (await usdc.mint(addr, AMT)).wait());
  const u1 = (await usdc.balanceOf(addr)) as bigint;
  await withRetry("approve", async () => (await usdc.approve(WRAP, AMT)).wait());
  trace(`USDC minted: ${u0} -> ${u1} (+${u1 - u0})`);

  // wrap
  const wtx = await withRetry("wrap", async () => (await wrap.wrap(addr, AMT)).wait());
  const u2 = (await usdc.balanceOf(addr)) as bigint;
  const cbalH = (await wrap.confidentialBalanceOf(addr)) as string;
  const cbal = await withRetry("decrypt cbal", () => fhevm.userDecryptEuint(FhevmType.euint64, cbalH, WRAP, me));
  trace(`wrap tx=${wtx.hash}; USDC ${u1}->${u2} (-${u1 - u2}); cUSDT bal decrypted=${cbal}`);
  out.wrap = { amount: AMT.toString(), usdcBefore: u1.toString(), usdcAfter: u2.toString(), usdcSpent: (u1 - u2).toString(), cUSDTbalance: cbal.toString(), wrapTx: wtx.hash, pass: (u1 - u2) === AMT && cbal === AMT };
  fs.writeFileSync(OUT, JSON.stringify(out, J, 2));

  // unwrap request: build encrypted amount handle for AMT, then unwrap(from,to,encAmt,proof)
  const enc = await withRetry("encrypt unwrap amt", () => fhevm.createEncryptedInput(WRAP, addr).add64(AMT).encrypt());
  const wrapWithProof = new ethers.Contract(WRAP, ["function unwrap(address from, address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)"], me);
  const utx = await withRetry("unwrap-request", async () => (await wrapWithProof.unwrap(addr, addr, enc.handles[0], enc.inputProof)).wait());
  trace(`unwrap-request tx=${utx.hash}`);

  // find requestId from the receipt logs: _unwrap returns it; also stored. Parse UnwrapInitiated-ish event.
  // The OZ wrapper keys requests by a bytes32 id == euint64.unwrap(amount handle). We can read unwrapAmount(id).
  // Simpler: the request id is emitted; scan logs for a 32-byte topic we can query unwrapAmount on.
  let requestId = "";
  for (const log of utx.logs) {
    for (const t of log.topics) {
      try { const h = (await wrap.unwrapAmount(t)) as string; if (h && h !== ethers.ZeroHash) { requestId = t; break; } } catch (e) {}
    }
    if (requestId) break;
  }
  if (!requestId) {
    // fallback: requestId may be the returned value; try data fields
    trace("requestId not found via topics; trying log data words");
    for (const log of utx.logs) {
      const data = log.data.slice(2);
      for (let i = 0; i + 64 <= data.length; i += 64) {
        const w = "0x" + data.slice(i, i + 64);
        try { const h = (await wrap.unwrapAmount(w)) as string; if (h && h !== ethers.ZeroHash) { requestId = w; break; } } catch (e) {}
      }
      if (requestId) break;
    }
  }
  trace(`unwrap requestId=${requestId || "NOT FOUND"}`);
  out.unwrap = { unwrapTx: utx.hash, requestId };

  if (requestId) {
    const amtH = (await wrap.unwrapAmount(requestId)) as string;
    // public-decrypt the unwrap amount via the low-level relayer instance -> {clearValues, decryptionProof}
    const instance = await withRetry("createInstance", () => fhevm.createInstance());
    const pd = await withRetry("publicDecrypt", () => (instance as any).publicDecrypt([amtH]));
    const clear = pd.clearValues[amtH] ?? Object.values(pd.clearValues)[0];
    const cleartext = BigInt(clear as any);
    trace(`publicDecrypt unwrapAmount=${cleartext} proofBytes=${(pd.decryptionProof.length - 2) / 2}`);
    const ftx = await withRetry("finalizeUnwrap", async () => (await wrap.finalizeUnwrap(requestId, cleartext, pd.decryptionProof)).wait());
    const u3 = (await usdc.balanceOf(addr)) as bigint;
    trace(`finalizeUnwrap tx=${ftx.hash}; USDC ${u2}->${u3} (+${u3 - u2})`);
    out.unwrap = { ...out.unwrap, unwrapAmountCleartext: cleartext.toString(), finalizeTx: ftx.hash, usdcReturned: (u3 - u2).toString(), pass: (u3 - u2) === AMT };
  } else {
    out.unwrap = { ...out.unwrap, pass: false, note: "could not resolve unwrap requestId" };
  }

  out.at1_pass = out.wrap.pass && out.unwrap.pass;
  fs.writeFileSync(OUT, JSON.stringify(out, J, 2));
  trace(`WRAP_DONE wrap=${out.wrap.pass} unwrap=${out.unwrap.pass}`);
}
main().catch((e) => { trace(`WRAP_FATAL ${(e?.message ?? e).toString().slice(0, 160)}`); process.exit(1); });
