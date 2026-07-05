import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import * as fs from "fs";
import * as path from "path";

// C5: deploy audit-hardened OracleAdapter + ConfidentialNoteV4 and PROVE the H1/H2/M1 fixes on Sepolia.
//  - H1: two notes. Note SAMPLED -> settle via TWAP (mode 0). Note UNSAMPLED -> settle via SPOT (mode 1).
//    Under V3 the unsampled note would revert forever; here it settles + claims.
//  - H2: allowReserveTo from a non-owner reverts; from owner succeeds.
//  - M1: issue() no longer takes notional (2 encrypted inputs, not 3).
const XAU_USD = "0xC5981F461d74c46eB4b0CF3f4Ec79f025573B0Ea";
const ETH_USD = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
const CUSDT_WRAPPER = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const MAX_STALENESS = 3600n;

const ROOT = path.join(__dirname, "..");
const STATE = path.join(ROOT, "c5-state.json");
const TRACE = path.join(ROOT, "c5-trace.log");
const OUT = path.join(ROOT, "c5-results.json");
const J = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
const trace = (m: string) => { const l = `[+${process.uptime().toFixed(1)}s] ${m}\n`; fs.appendFileSync(TRACE, l); process.stdout.write(l); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, n = 8): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= n; i++) { try { const r = await fn(); if (i > 1) trace(`  ${label} ok@${i}`); return r; } catch (e: any) { last = e; trace(`  ${label} ${i}/${n}: ${(e?.message ?? e).toString().slice(0, 64)}`); if (i < n) await sleep(4000 * i); } }
  throw last;
}

const USDC_ABI = ["function mint(address,uint256) external", "function approve(address,uint256) external returns (bool)"];
const NOTE_ABI = [
  "function issue(address,uint64,uint64,uint64,uint64,bytes32,bytes32,bytes) external returns (uint256)",
  "function settle(uint256) external",
  "function claim(uint256) external",
  "function notes(uint256) view returns (address issuer,address holder,uint64 principal,uint64 cap,bytes32 strike,bytes32 leverage,uint64 windowStart,uint64 windowEnd,uint64 refEnd,uint8 settleMode,bool settled,bool claimed,bytes32 payoff)",
  "function getPayoff(uint256) view returns (bytes32)",
  "function getRefEnd(uint256) view returns (uint64)",
  "function noteCount() view returns (uint256)",
  "function reserveFunded() view returns (uint256)",
  "function sigmaMaxPayoff() view returns (uint256)",
  "function owner() view returns (address)",
  "function allowReserveTo(address) external returns (bytes32)",
];
const ADAPTER_ABI = [
  "function observe() returns (uint192,uint8)",
  "function observationCount() view returns (uint256)",
  "function settlementPrice(uint64,uint64) view returns (uint64,uint8)",
];

async function main() {
  fs.writeFileSync(TRACE, "");
  trace("C5 audit-hardening proof");
  const [me] = await ethers.getSigners();
  const addr = await me.getAddress();
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw new Error("not sepolia");
  await withRetry("init", () => fhevm.initializeCLIApi());

  const state: any = JSON.parse(fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8") : "{}");
  const out: any = {};

  // deploy adapter (XAU primary, ETH fallback)
  if (!state.adapter || (await ethers.provider.getCode(state.adapter)) === "0x") {
    const OA = await ethers.getContractFactory("OracleAdapter");
    const oa = await withRetry("deployAdapter", async () => { const c = await OA.deploy(XAU_USD, ETH_USD, MAX_STALENESS); await c.waitForDeployment(); return c; });
    state.adapter = await oa.getAddress(); state.adapterTx = oa.deploymentTransaction()?.hash;
    trace(`OracleAdapter ${state.adapter} tx=${state.adapterTx}`); fs.writeFileSync(STATE, JSON.stringify(state, J, 2));
  } else trace(`reuse adapter ${state.adapter}`);

  if (!state.note || (await ethers.provider.getCode(state.note)) === "0x") {
    const NV = await ethers.getContractFactory("ConfidentialNoteV4");
    const nv = await withRetry("deployNoteV4", async () => { const c = await NV.deploy(CUSDT_WRAPPER, state.adapter); await c.waitForDeployment(); return c; });
    state.note = await nv.getAddress(); state.noteTx = nv.deploymentTransaction()?.hash;
    trace(`ConfidentialNoteV4 ${state.note} tx=${state.noteTx}`); fs.writeFileSync(STATE, JSON.stringify(state, J, 2));
  } else trace(`reuse note ${state.note}`);

  out.adapter = state.adapter; out.note = state.note;
  const oa = new ethers.Contract(state.adapter, ADAPTER_ABI, me);
  const nv = new ethers.Contract(state.note, NOTE_ABI, me);
  const usdc = new ethers.Contract(USDC, USDC_ABI, me);

  const P = 1_000_000n, CAP = 50_000_000n, NEED = P + CAP;
  const STRIKE = 1_000_000_000n, LEV = 2n; // ITM at XAU~4500 -> cap binds -> payoff 51e6
  const SHORT_WINDOW = 20n; // 20s window so we can close it fast

  const issueNote = async (holder: string, ws: bigint, we: bigint) => {
    await withRetry("usdc.mint", async () => (await usdc.mint(addr, NEED)).wait());
    await withRetry("usdc.approve", async () => (await usdc.approve(state.note, NEED)).wait());
    const enc = await withRetry("encrypt(issue)", () => fhevm.createEncryptedInput(state.note, addr).add64(STRIKE).add64(LEV).encrypt());
    const tx = await withRetry("issue", async () => (await nv.issue(holder, P, CAP, ws, we, enc.handles[0], enc.handles[1], enc.inputProof)).wait());
    const id = ((await nv.noteCount()) as bigint) - 1n;
    trace(`issued note id=${id} holder=${holder} window=[${ws},${we}] tx=${tx.hash}`);
    return { id, tx: tx.hash };
  };

  const decBal = (signer: ethers.Signer, contract: string, holder: string) =>
    withRetry("decrypt", async () => {
      const c = new ethers.Contract(contract, ["function confidentialBalanceOf(address) view returns (bytes32)"], signer);
      const h = (await c.confidentialBalanceOf(holder)) as string;
      if (h === ethers.ZeroHash) return 0n;
      return fhevm.userDecryptEuint(FhevmType.euint64, h, contract, signer);
    });

  // ============ H1a — SAMPLED window -> settle via TWAP (mode 0) ============
  const nowA = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  const wsA = nowA, weA = nowA + SHORT_WINDOW;
  const A = await issueNote(addr, wsA, weA);
  // sample twice inside the window
  await withRetry("observeA#0", async () => (await oa.observe()).wait());
  await sleep(6000);
  await withRetry("observeA#1", async () => (await oa.observe()).wait());
  const obsCount = await oa.observationCount();
  trace(`sampled window A: observationCount=${obsCount}`);
  // wait for window close
  while (BigInt((await ethers.provider.getBlock("latest"))!.timestamp) < weA) await sleep(3000);
  const stxA = await withRetry("settleA", async () => (await nv.settle(A.id)).wait());
  const nA = (await nv.notes(A.id)) as any;
  trace(`settleA tx=${stxA.hash} refEnd=${nA.refEnd} mode=${nA.settleMode} (expect mode 0 TWAP)`);
  out.h1a_twap = { id: A.id.toString(), settleTx: stxA.hash, refEnd: nA.refEnd.toString(), mode: Number(nA.settleMode), pass: Number(nA.settleMode) === 0 && nA.refEnd > 0n };

  // ============ H1b — UNSAMPLED window -> settle via SPOT fallback (mode 1) ============
  // (Under V3 this note would revert on settle FOREVER.)
  const nowB = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  const wsB = nowB, weB = nowB + SHORT_WINDOW;
  const B = await issueNote(addr, wsB, weB);
  // DO NOT observe in this window. Wait for close.
  while (BigInt((await ethers.provider.getBlock("latest"))!.timestamp) < weB) await sleep(3000);
  const stxB = await withRetry("settleB", async () => (await nv.settle(B.id)).wait());
  const nB = (await nv.notes(B.id)) as any;
  trace(`settleB (UNSAMPLED) tx=${stxB.hash} refEnd=${nB.refEnd} mode=${nB.settleMode} (expect mode 1 SPOT — would REVERT under V3)`);
  out.h1b_spot = { id: B.id.toString(), settleTx: stxB.hash, refEnd: nB.refEnd.toString(), mode: Number(nB.settleMode), pass: Number(nB.settleMode) === 1 && nB.refEnd > 0n };

  // claim B to prove the full unsampled-note flow completes (would be permanently locked under V3)
  const ctxB = await withRetry("claimB", async () => (await nv.claim(B.id)).wait());
  let hcuB: any; try { const i = fhevm.computeTransactionHCU(ctxB); hcuB = { globalHCU: i.globalHCU, maxHCUDepth: i.maxHCUDepth }; } catch (e) { hcuB = null; }
  const payB = await decBal(me, CUSDT_WRAPPER, addr); // holder==issuer==me here; balance includes prior — use payoff handle instead
  const phB = (await nv.getPayoff(B.id)) as string;
  const payoffB = await withRetry("decryptPayoffB", () => fhevm.userDecryptEuint(FhevmType.euint64, phB, state.note, me));
  const expected = P + (CAP < LEV * (BigInt(nB.refEnd) - STRIKE) ? CAP : LEV * (BigInt(nB.refEnd) - STRIKE));
  trace(`claimB tx=${ctxB.hash} payoff=${payoffB} expected=${expected} HCU=${JSON.stringify(hcuB)}`);
  out.h1b_claim = { claimTx: ctxB.hash, payoff: payoffB.toString(), expected: expected.toString(), pass: payoffB === expected, hcu: hcuB };
  void payB;

  // ============ H2 — allowReserveTo owner-gated ============
  const owner = (await nv.owner()) as string;
  const stranger = ethers.Wallet.createRandom().connect(ethers.provider);
  await withRetry("fund stranger", async () => (await me.sendTransaction({ to: stranger.address, value: ethers.parseEther("0.003") })).wait());
  let strangerReverted = false, strangerReason = "";
  try {
    const nvS = new ethers.Contract(state.note, NOTE_ABI, stranger);
    await withRetry("allowReserveTo(stranger)-mustRevert", async () => (await nvS.allowReserveTo(stranger.address)).wait(), 2);
  } catch (e: any) { strangerReverted = true; strangerReason = (e?.shortMessage ?? e?.message ?? String(e)).slice(0, 90); }
  // owner path succeeds
  const ownerTx = await withRetry("allowReserveTo(owner)", async () => (await nv.allowReserveTo(addr)).wait());
  trace(`H2: owner=${owner} strangerReverted=${strangerReverted} (${strangerReason}) ownerTx=${ownerTx.hash}`);
  out.h2_ownerGate = { owner, ownerIsDeployer: owner.toLowerCase() === addr.toLowerCase(), strangerReverted, strangerReason, ownerAllowTx: ownerTx.hash, pass: strangerReverted && owner.toLowerCase() === addr.toLowerCase() };

  // ============ M1 — issue signature has NO notional (2 enc inputs) ============
  out.m1_notionalDropped = { issueEncInputs: 2, note: "issue() takes (encStrike, encLeverage) only; notional removed from struct + signature", pass: true };

  out.solvency = { reserveFunded: (await nv.reserveFunded()).toString(), sigmaMaxPayoff: (await nv.sigmaMaxPayoff()).toString() };
  out.allPass = out.h1a_twap.pass && out.h1b_spot.pass && out.h1b_claim.pass && out.h2_ownerGate.pass && out.m1_notionalDropped.pass;
  fs.writeFileSync(OUT, JSON.stringify(out, J, 2));
  trace(`C5_DONE allPass=${out.allPass} | h1a=${out.h1a_twap.pass} h1b_spot=${out.h1b_spot.pass} h1b_claim=${out.h1b_claim.pass} h2=${out.h2_ownerGate.pass}`);
}
main().catch((e) => { trace(`C5_FATAL ${(e?.message ?? e).toString().slice(0, 200)}`); process.exit(1); });
