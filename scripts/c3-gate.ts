import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import * as fs from "fs";
import * as path from "path";

// AT#2 (phantom-credit gate) + AT#3 (public solvency) on ConfidentialNoteV3.
//  AT#2: with INSUFFICIENT USDC allowance/balance, issue() must REVERT at the wrap.
//        Prove: reserveFunded unchanged, sigmaMaxPayoff unchanged, noteCount unchanged.
//  AT#3: a properly-funded issue moves reserveFunded & sigmaMaxPayoff by exactly maxPayoff,
//        equal to the USDC the issuer spent (balance delta) and the cUSDT now in the reserve.
const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const CUSDT = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
const ERC20 = ["function mint(address,uint256)", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"];
const NOTE_ABI = [
  "function issue(address,uint64,uint64,uint64,uint64,bytes32,bytes32,bytes32,bytes) returns (uint256)",
  "function reserveFunded() view returns (uint256)",
  "function sigmaMaxPayoff() view returns (uint256)",
  "function noteCount() view returns (uint256)",
  "function reserveBalanceHandle() view returns (bytes32)",
  "function allowReserveTo(address) returns (bytes32)",
];
const ROOT = path.join(__dirname, "..");
const STATE = path.join(ROOT, "c3-state.json");
const TRACE = path.join(ROOT, "c3-trace.log");
const OUT = path.join(ROOT, "c3-gate.json");
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
  const note = new ethers.Contract(state.note, NOTE_ABI, me);
  const out: any = { note: state.note };

  const enc = async () => withRetry("encrypt", () => fhevm.createEncryptedInput(state.note, addr).add64(1_000_000_000n).add64(2n).add64(1_000_000n).encrypt());
  const principal = 1_000_000n, cap = 50_000_000n, need = principal + cap; // 51 USDC
  const ws = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  const we = ws + 600n;

  // ===== AT#2 — underfunded issue MUST revert at the wrap, no state mutation =====
  // ensure issuer has < need USDC allowance: set allowance to 0 and balance to < need.
  const rf0 = (await note.reserveFunded()) as bigint;
  const smp0 = (await note.sigmaMaxPayoff()) as bigint;
  const nc0 = (await note.noteCount()) as bigint;
  await withRetry("approve0", async () => (await usdc.approve(state.note, 0n)).wait()); // revoke allowance
  const bal = (await usdc.balanceOf(addr)) as bigint;
  trace(`AT#2 pre: reserveFunded=${rf0} sigma=${smp0} noteCount=${nc0} usdcBal=${bal} allowance=0`);
  const e2 = await enc();
  let reverted = false, reason = "";
  try { await withRetry("issue-underfunded-mustRevert", async () => (await note.issue(addr, principal, cap, ws, we, e2.handles[0], e2.handles[1], e2.handles[2], e2.inputProof)).wait(), 2); }
  catch (err: any) { reverted = true; reason = (err?.shortMessage ?? err?.message ?? String(err)).slice(0, 130); }
  const rf1 = (await note.reserveFunded()) as bigint;
  const smp1 = (await note.sigmaMaxPayoff()) as bigint;
  const nc1 = (await note.noteCount()) as bigint;
  out.at2 = {
    reverted, reason,
    reserveFunded_before: rf0.toString(), reserveFunded_after: rf1.toString(),
    sigma_before: smp0.toString(), sigma_after: smp1.toString(),
    noteCount_before: nc0.toString(), noteCount_after: nc1.toString(),
    pass: reverted && rf1 === rf0 && smp1 === smp0 && nc1 === nc0,
  };
  trace(`AT#2 phantom-gate: reverted=${reverted} reason="${reason}" rfΔ=${rf1 - rf0} sigmaΔ=${smp1 - smp0} ncΔ=${nc1 - nc0} pass=${out.at2.pass}`);
  fs.writeFileSync(OUT, JSON.stringify(out, J, 2));

  // ===== AT#3 — funded issue: accumulators move by exactly maxPayoff == USDC spent == reserve cUSDT =====
  await withRetry("mint", async () => (await usdc.mint(addr, need)).wait());
  await withRetry("approve", async () => (await usdc.approve(state.note, need)).wait());
  const ub0 = (await usdc.balanceOf(addr)) as bigint;
  const e3 = await enc();
  const itx = await withRetry("issue-funded", async () => (await note.issue(addr, principal, cap, ws, we, e3.handles[0], e3.handles[1], e3.handles[2], e3.inputProof)).wait());
  const ub1 = (await usdc.balanceOf(addr)) as bigint;
  const rf2 = (await note.reserveFunded()) as bigint;
  const smp2 = (await note.sigmaMaxPayoff()) as bigint;
  const nc2 = (await note.noteCount()) as bigint;
  const id = nc2 - 1n;
  state.gateNoteId = id.toString(); fs.writeFileSync(STATE, JSON.stringify(state, J, 2));

  // decrypt the reserve's confidential cUSDT balance to tie public ledger to real backing
  await withRetry("allowReserve", async () => (await note.allowReserveTo(addr)).wait());
  const rbH = (await note.reserveBalanceHandle()) as string;
  const reserveBal = await withRetry("decrypt reserve", () => fhevm.userDecryptEuint(FhevmType.euint64, rbH, CUSDT, me));
  out.at3 = {
    issueTx: itx.hash, noteId: id.toString(),
    usdcSpent: (ub0 - ub1).toString(), maxPayoff: need.toString(),
    reserveFunded: rf2.toString(), sigmaMaxPayoff: smp2.toString(),
    reserveCUSDTbalance_decrypted: reserveBal.toString(),
    reserveFundedGEsigma: rf2 >= smp2,
    pass: (ub0 - ub1) === need && rf2 === rf0 + need && smp2 === smp0 + need && reserveBal >= need && rf2 >= smp2,
  };
  trace(`AT#3 solvency: usdcSpent=${ub0 - ub1} maxPayoff=${need} reserveFunded=${rf2} sigma=${smp2} reserveCUSDT=${reserveBal} pass=${out.at3.pass}`);
  fs.writeFileSync(OUT, JSON.stringify(out, J, 2));
  trace(`GATE_DONE at2=${out.at2.pass} at3=${out.at3.pass}`);
}
main().catch((e) => { trace(`GATE_FATAL ${(e?.message ?? e).toString().slice(0, 160)}`); process.exit(1); });
