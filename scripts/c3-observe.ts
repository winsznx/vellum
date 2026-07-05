import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// C2 phase 3: sample real Chainlink observations across the open window until it closes.
// One observe() ~every OBS_INTERVAL until block.timestamp >= windowEnd. Each appended to state.
const ADAPTER_ABI = [
  "function observe() returns (uint192,uint8)",
  "function observationCount() view returns (uint256)",
  "function observations(uint256) view returns (uint64,uint192,uint8)",
  "function peek(bool) view returns (uint192,uint256,bool)",
];
const OBS_INTERVAL_MS = 270_000; // ~4.5 min between samples
const ROOT = path.join(__dirname, "..");
const STATE = path.join(ROOT, "c3-state.json");
const TRACE = path.join(ROOT, "c3-trace.log");
const J = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
const trace = (m: string) => { const l = `[+${process.uptime().toFixed(1)}s] ${m}\n`; fs.appendFileSync(TRACE, l); process.stdout.write(l); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, n = 6): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= n; i++) { try { const r = await fn(); if (i > 1) trace(`  ${label} ok@${i}`); return r; } catch (e: any) { last = e; trace(`  ${label} ${i}/${n}: ${(e?.message ?? e).toString().slice(0, 56)}`); if (i < n) await sleep(4000 * i); } }
  throw last;
}

async function main() {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const save = () => fs.writeFileSync(STATE, JSON.stringify(state, J, 2));
  const [me] = await ethers.getSigners();
  const oa = new ethers.Contract(state.adapter, ADAPTER_ABI, me);
  const windowEnd = Number(state.goldNote.windowEnd);
  trace(`observe phase: windowEnd=${windowEnd}, sampling every ${OBS_INTERVAL_MS / 1000}s`);
  state.goldObs = state.goldObs || [];

  while (true) {
    const blk = (await withRetry("getBlock", async () => ethers.provider.getBlock("latest")))!;
    const now = blk.timestamp;
    if (now >= windowEnd) { trace(`window closed (now=${now} >= ${windowEnd}); stopping sampler`); break; }

    // peek current price for the log, then observe()
    const peek = await withRetry("peek", async () => oa.peek(false));
    const obtx = await withRetry("observe", async () => (await oa.observe()).wait());
    const cnt = await oa.observationCount();
    state.goldObs.push({ tx: obtx.hash, ts: now, price1e6: peek[0].toString(), countAfter: cnt.toString() });
    trace(`observe#${state.goldObs.length - 1} ts=${now} price1e6=${peek[0]} count=${cnt} tx=${obtx.hash}`); save();

    const remaining = windowEnd - now;
    const waitMs = Math.min(OBS_INTERVAL_MS, Math.max(0, (remaining - 20) * 1000));
    if (waitMs <= 0) { trace("near window end; final sample taken"); break; }
    trace(`sleep ${(waitMs / 1000).toFixed(0)}s (window closes in ${remaining}s)`);
    await sleep(waitMs);
  }
  trace(`OBSERVE_DONE samples=${state.goldObs.length}`);
}
main().catch((e) => { trace(`OBSERVE_FATAL ${(e?.message ?? e).toString().slice(0, 140)}`); process.exit(1); });
