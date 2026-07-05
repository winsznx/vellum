import { ethers, fhevm } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// Gold-leg note: fund via wrap, issue with a ~35min XAU window, take observation #0.
const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const ERC20 = ["function mint(address,uint256)", "function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"];
const NOTE_ABI = ["function issue(address,uint64,uint64,uint64,uint64,bytes32,bytes32,bytes32,bytes) returns (uint256)", "function noteCount() view returns (uint256)", "function reserveFunded() view returns (uint256)", "function sigmaMaxPayoff() view returns (uint256)"];
const ADAPTER_ABI = ["function observe() returns (uint192,uint8)", "function observationCount() view returns (uint256)", "function peek(bool) view returns (uint192,uint256,bool)"];
const WINDOW_SECS = 2100n; // 35 min
const ROOT = path.join(__dirname, "..");
const STATE = path.join(ROOT, "c3-state.json");
const TRACE = path.join(ROOT, "c3-trace.log");
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
  const oa = new ethers.Contract(state.adapter, ADAPTER_ABI, me);

  if (state.goldNote) { trace(`gold note already issued id=${state.goldNote.id}`); return; }

  const principal = 1_000_000n, cap = 50_000_000n, need = principal + cap;
  // XAU/USD ~ $4,483 -> refEnd ~4,483,730,000 (1e6). strike 1,000,000,000 ($1000) -> deep ITM,
  // lev 2 -> 2*(4483e6-1000e6)=~6967e6 >> cap 50e6 -> CAP BINDS -> payoff 51e6 (deterministic).
  const strike = 1_000_000_000n, lev = 2n, notional = 1_000_000n;

  await withRetry("mint", async () => (await usdc.mint(addr, need)).wait());
  await withRetry("approve", async () => (await usdc.approve(state.note, need)).wait());
  const enc = await withRetry("encrypt", () => fhevm.createEncryptedInput(state.note, addr).add64(strike).add64(lev).add64(notional).encrypt());

  const blk = (await ethers.provider.getBlock("latest"))!;
  const ws = BigInt(blk.timestamp);
  const we = ws + WINDOW_SECS;
  const itx = await withRetry("issue-gold", async () => (await note.issue(addr, principal, cap, ws, we, enc.handles[0], enc.handles[1], enc.handles[2], enc.inputProof)).wait());
  const id = ((await note.noteCount()) as bigint) - 1n;
  state.goldNote = { id: id.toString(), principal: principal.toString(), cap: cap.toString(), strike: strike.toString(), lev: lev.toString(), windowStart: ws.toString(), windowEnd: we.toString(), issueTx: itx.hash, expectedPayoff: "51000000" };
  trace(`issued GOLD note id=${id} window=[${ws},${we}] issueTx=${itx.hash} reserveFunded=${await note.reserveFunded()} sigma=${await note.sigmaMaxPayoff()}`);
  fs.writeFileSync(STATE, JSON.stringify(state, J, 2));

  // observation #0 (XAU)
  const peek = await withRetry("peek", async () => oa.peek(false));
  const obtx = await withRetry("observe#0", async () => (await oa.observe()).wait());
  state.goldObs = [{ tx: obtx.hash, ts: blk.timestamp, price1e6: peek[0].toString(), countAfter: (await oa.observationCount()).toString() }];
  trace(`observe#0 XAU price1e6=${peek[0]} tx=${obtx.hash}`);
  fs.writeFileSync(STATE, JSON.stringify(state, J, 2));
  trace(`GOLD_ISSUE_DONE id=${id} windowEnd=${we}`);
}
main().catch((e) => { trace(`GOLD_ISSUE_FATAL ${(e?.message ?? e).toString().slice(0, 160)}`); process.exit(1); });
