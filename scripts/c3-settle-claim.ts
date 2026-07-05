import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import * as fs from "fs";
import * as path from "path";

// AT#4 (confidential payout) + AT#5 (gold-leg full flow).
//  settle(XAU TWAP) -> claim (computes payoff, pays out of reserve via confidentialTransfer) ->
//  holder userDecrypts RECEIVED cUSDT balance == expected payoff (in band);
//  a second wallet cannot decrypt the holder's cUSDT balance handle;
//  reserve cUSDT decremented by payoff. Report HCU on the claim receipt.
const CUSDT = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
const NOTE_ABI = [
  "function settle(uint256) external",
  "function claim(uint256) external",
  "function notes(uint256) view returns (address issuer,address holder,uint64 principal,uint64 cap,bytes32 strike,bytes32 leverage,bytes32 notional,uint64 windowStart,uint64 windowEnd,uint64 refEnd,bool settled,bool claimed,bytes32 payoff)",
  "function getPayoff(uint256) view returns (bytes32)",
  "function getRefEnd(uint256) view returns (uint64)",
  "function reserveBalanceHandle() view returns (bytes32)",
  "function allowReserveTo(address) returns (bytes32)",
  "function reserveFunded() view returns (uint256)",
  "function sigmaMaxPayoff() view returns (uint256)",
];
const ADAPTER_ABI = ["function twap(uint64,uint64) view returns (uint64)", "function observationCount() view returns (uint256)", "function observations(uint256) view returns (uint64 ts,uint192 price1e6,uint8 source)"];
const WRAP_ABI = ["function confidentialBalanceOf(address) view returns (bytes32)"];
const ROOT = path.join(__dirname, "..");
const STATE = path.join(ROOT, "c3-state.json");
const TRACE = path.join(ROOT, "c3-trace.log");
const OUT = path.join(ROOT, "c3-results.json");
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
  const note = new ethers.Contract(state.note, NOTE_ABI, me);
  const oa = new ethers.Contract(state.adapter, ADAPTER_ABI, me);
  const wrap = new ethers.Contract(CUSDT, WRAP_ABI, ethers.provider);
  const g = state.goldNote;
  const id = BigInt(g.id), ws = BigInt(g.windowStart), we = BigInt(g.windowEnd);
  const out: any = { note: state.note, adapter: state.adapter, id: id.toString(), ref: "XAU/USD" };

  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  if (BigInt(now) < we) throw new Error(`window open (now=${now} < ${we})`);

  // AT#5a — XAU TWAP hand-check
  const cnt = Number(await withRetry("obsCount", async () => oa.observationCount()));
  const obs: { ts: bigint; price: bigint }[] = [];
  for (let i = 0; i < cnt; i++) { const o = await withRetry(`obs(${i})`, async () => oa.observations(i)); obs.push({ ts: o[0] as bigint, price: o[1] as bigint }); }
  const inWin = obs.filter((o) => o.ts >= ws && o.ts <= we);
  let hand = 0n;
  if (inWin.length >= 2) { const span = inWin[inWin.length - 1].ts - inWin[0].ts; let acc = 0n; for (let i = 0; i < inWin.length - 1; i++) acc += inWin[i].price * (inWin[i + 1].ts - inWin[i].ts); hand = acc / span; }
  const onchainTwap = await withRetry("twap", async () => oa.twap(ws, we)) as bigint;
  out.twap = { inWindow: inWin.length, prices: inWin.map((o) => o.price.toString()), handTwap: hand.toString(), onchainTwap: onchainTwap.toString(), pass: inWin.length >= 2 && onchainTwap === hand };
  trace(`XAU TWAP: onchain=${onchainTwap} hand=${hand} inWin=${inWin.length} pass=${out.twap.pass}`);

  // reserve before payout
  const reserveH0 = await withRetry("reserveH0", async () => note.reserveBalanceHandle());
  await withRetry("allowReserve0", async () => (await note.allowReserveTo(addr)).wait());
  const reserveBefore = await withRetry("decReserve0", () => fhevm.userDecryptEuint(FhevmType.euint64, reserveH0 as string, CUSDT, me));
  const sigmaBefore = await note.sigmaMaxPayoff();

  // AT#4 settle (XAU TWAP)
  const n0 = (await note.notes(id)) as any;
  let settleTx = "already";
  if (!n0.settled) { const stx = await withRetry("settle", async () => (await note.settle(id)).wait()); settleTx = stx.hash; }
  const refEnd = await withRetry("getRefEnd", async () => note.getRefEnd(id)) as bigint;
  trace(`settle tx=${settleTx} refEnd=${refEnd} ==twap? ${refEnd === onchainTwap}`);

  // holder cUSDT balance before claim (holder = issuer here)
  const holderBalBeforeH = (await wrap.confidentialBalanceOf(addr)) as string;
  const holderBalBefore = await withRetry("decHolder0", () => fhevm.userDecryptEuint(FhevmType.euint64, holderBalBeforeH, CUSDT, me));

  // claim -> computes payoff + confidentialTransfer to holder
  const claimRc = await withRetry("claim", async () => (await note.claim(id)).wait());
  let hcu: any; try { const i = fhevm.computeTransactionHCU(claimRc); hcu = { globalHCU: i.globalHCU, maxHCUDepth: i.maxHCUDepth }; } catch (e: any) { hcu = { error: (e?.message ?? String(e)).slice(0, 70) }; }
  trace(`claim tx=${claimRc.hash} HCU=${JSON.stringify(hcu)}`);

  // payoff handle decrypt (the computed number)
  const payoffH = (await note.getPayoff(id)) as string;
  const payoffNum = await withRetry("decPayoff", () => fhevm.userDecryptEuint(FhevmType.euint64, payoffH, state.note, me));

  // holder cUSDT balance AFTER claim — the RECEIVED confidential payout
  const holderBalAfterH = (await wrap.confidentialBalanceOf(addr)) as string;
  const holderBalAfter = await withRetry("decHolder1", () => fhevm.userDecryptEuint(FhevmType.euint64, holderBalAfterH, CUSDT, me));
  const received = holderBalAfter - holderBalBefore;

  // reserve after payout
  await withRetry("allowReserve1", async () => (await note.allowReserveTo(addr)).wait());
  const reserveH1 = await withRetry("reserveH1", async () => note.reserveBalanceHandle());
  const reserveAfter = await withRetry("decReserve1", () => fhevm.userDecryptEuint(FhevmType.euint64, reserveH1 as string, CUSDT, me));
  const sigmaAfter = await note.sigmaMaxPayoff();

  const principal = BigInt(g.principal), cap = BigInt(g.cap), strike = BigInt(g.strike), lev = BigInt(g.lev);
  const intrinsic = refEnd > strike ? refEnd - strike : 0n;
  const expected = principal + (cap < lev * intrinsic ? cap : lev * intrinsic);

  // AT#4b — second wallet cannot decrypt holder's cUSDT balance handle
  const other = ethers.Wallet.createRandom().connect(ethers.provider);
  let sealed = false, sealedDetail = "";
  try { const leak = await fhevm.userDecryptEuint(FhevmType.euint64, holderBalAfterH, CUSDT, other); sealedDetail = "LEAK=" + leak; }
  catch (e: any) { const m = (e?.message ?? String(e)).toLowerCase(); sealed = m.includes("not authorized") || m.includes("not allowed") || m.includes("acl") || m.includes("user decrypt"); sealedDetail = (e?.message ?? "").slice(0, 100); }

  out.at4 = {
    settleTx, claimTx: claimRc.hash, refEnd1e6: refEnd.toString(),
    payoffComputed: payoffNum.toString(), expected: expected.toString(),
    holderReceivedCUSDT: received.toString(),
    reserveBefore: reserveBefore.toString(), reserveAfter: reserveAfter.toString(), reserveDelta: (reserveBefore - reserveAfter).toString(),
    sigmaBefore: sigmaBefore.toString(), sigmaAfter: sigmaAfter.toString(),
    secondWalletSealed: sealed, sealedDetail,
    pass: received === expected && payoffNum === expected && (reserveBefore - reserveAfter) === expected && sealed && received >= principal && received <= principal + cap,
  };
  out.at5 = {
    ref: "XAU/USD", refEnd1e6: refEnd.toString(), refEndEqualsTwap: refEnd === onchainTwap,
    strike1e6: strike.toString(), intrinsic1e6: intrinsic.toString(), expected: expected.toString(),
    decryptedPayout: received.toString(), inBand: received >= principal && received <= principal + cap, hcu,
    pass: refEnd === onchainTwap && received === expected && received >= principal && received <= principal + cap,
  };
  out.allPass = out.twap.pass && out.at4.pass && out.at5.pass;
  fs.writeFileSync(OUT, JSON.stringify(out, J, 2));
  trace(`SC_DONE twap=${out.twap.pass} at4=${out.at4.pass} at5=${out.at5.pass} | refEnd=${refEnd} payout=${received} expected=${expected} reserveΔ=${reserveBefore - reserveAfter} sealed=${sealed} HCU=${JSON.stringify(hcu)}`);
}
main().catch((e) => { trace(`SC_FATAL ${(e?.message ?? e).toString().slice(0, 180)}`); process.exit(1); });
