import { ethers, fhevm } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Finalize the pending unwrap (AT#1 "and back"): publicDecrypt the request handle -> finalizeUnwrap.
const WRAP = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const REQUEST_ID = "0x141034cc5ca227c7920e4908e1970a6d16e25ee832ff0000000000aa36a70500";
const AMT = 10_000_000n;
const ROOT = path.join(__dirname, "..");
const TRACE = path.join(ROOT, "c3-trace.log");
const OUT = path.join(ROOT, "c3-wrap.json");
const J = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
const trace = (m: string) => { const l = `[+${process.uptime().toFixed(1)}s] ${m}\n`; fs.appendFileSync(TRACE, l); process.stdout.write(l); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, n = 10): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= n; i++) { try { const r = await fn(); if (i > 1) trace(`  ${label} ok@${i}`); return r; } catch (e: any) { last = e; trace(`  ${label} ${i}/${n}: ${(e?.message ?? e).toString().slice(0, 60)}`); if (i < n) await sleep(5000 * i); } }
  throw last;
}

async function main() {
  const [me] = await ethers.getSigners();
  const addr = await me.getAddress();
  await withRetry("init", () => fhevm.initializeCLIApi());
  const usdc = new ethers.Contract(USDC, ["function balanceOf(address) view returns (uint256)"], me);
  const wrap = new ethers.Contract(WRAP, [
    "function finalizeUnwrap(bytes32 unwrapRequestId, uint64 unwrapAmountCleartext, bytes decryptionProof)",
    "function unwrapRequester(bytes32) view returns (address)",
    "function confidentialBalanceOf(address) view returns (bytes32)",
  ], me);

  const requester = (await wrap.unwrapRequester(REQUEST_ID)) as string;
  trace(`requestId requester=${requester} (expect ${addr})`);
  const u0 = (await usdc.balanceOf(addr)) as bigint;

  // public-decrypt the request handle (it was makePubliclyDecryptable in _unwrap)
  const instance = await withRetry("createInstance", () => fhevm.createInstance());
  const pd = await withRetry("publicDecrypt", () => (instance as any).publicDecrypt([REQUEST_ID]));
  const clear = pd.clearValues[REQUEST_ID] ?? Object.values(pd.clearValues)[0];
  const cleartext = BigInt(clear as any);
  trace(`publicDecrypt cleartext=${cleartext} proofBytes=${(pd.decryptionProof.length - 2) / 2}`);

  const ftx = await withRetry("finalizeUnwrap", async () => (await wrap.finalizeUnwrap(REQUEST_ID, cleartext, pd.decryptionProof)).wait());
  const u1 = (await usdc.balanceOf(addr)) as bigint;
  trace(`finalizeUnwrap tx=${ftx.hash}; USDC ${u0}->${u1} (+${u1 - u0})`);

  const out = JSON.parse(fs.readFileSync(OUT, "utf8"));
  out.unwrap = { requestId: REQUEST_ID, requester, unwrapAmountCleartext: cleartext.toString(), finalizeTx: ftx.hash, usdcReturned: (u1 - u0).toString(), pass: (u1 - u0) === AMT && cleartext === AMT };
  out.at1_pass = out.wrap.pass && out.unwrap.pass;
  fs.writeFileSync(OUT, JSON.stringify(out, J, 2));
  trace(`FINALIZE_DONE usdcReturned=${u1 - u0} cleartext=${cleartext} at1=${out.at1_pass}`);
}
main().catch((e) => { trace(`FINALIZE_FATAL ${(e?.message ?? e).toString().slice(0, 160)}`); process.exit(1); });
