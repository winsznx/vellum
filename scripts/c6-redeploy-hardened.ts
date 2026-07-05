import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import * as fs from "fs";
import * as path from "path";

// C6: redeploy the hardened OracleAdapter (binary-search window bounds + maturity-pinned spot) and a
// fresh ConfidentialNoteV4 pointing at it, then re-prove the core flow: issue -> observe -> settle(TWAP)
// -> claim (payoff decrypts exact). Confirms the H-1/M-1 fixes don't regress the happy path.
const XAU = "0xC5981F461d74c46eB4b0CF3f4Ec79f025573B0Ea";
const ETH = "0x694AA1769357215DE4FAC081bf1f309aDC325306";
const CUSDT = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639";
const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF";
const MAX_STALENESS = 3600n;

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "internal", "evidence", "c6-hardened.json");
const TRACE = path.join(ROOT, "c6-trace.log");
const J = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
const trace = (m: string) => { const l = `[+${process.uptime().toFixed(1)}s] ${m}\n`; fs.appendFileSync(TRACE, l); process.stdout.write(l); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, n = 8): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= n; i++) { try { const r = await fn(); if (i > 1) trace(`  ${label} ok@${i}`); return r; } catch (e: any) { last = e; trace(`  ${label} ${i}/${n}: ${(e?.message ?? e).toString().slice(0, 64)}`); if (i < n) await sleep(4000 * i); } }
  throw last;
}

async function main() {
  fs.writeFileSync(TRACE, "");
  trace("C6 redeploy hardened + reprove");
  const [me] = await ethers.getSigners();
  const addr = await me.getAddress();
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw new Error("not sepolia");
  await withRetry("init", () => fhevm.initializeCLIApi());
  const out: any = {};

  // resume: reuse an already-deployed hardened adapter if provided (network drops mid-run)
  let adapterAddr = process.env.C6_ADAPTER ?? "";
  if (!adapterAddr || (await ethers.provider.getCode(adapterAddr)) === "0x") {
    const OA = await ethers.getContractFactory("OracleAdapter");
    const oa = await withRetry("deployAdapter", async () => { const c = await OA.deploy(XAU, ETH, MAX_STALENESS); await c.waitForDeployment(); return c; });
    adapterAddr = await oa.getAddress();
    out.oracleAdapterTx = oa.deploymentTransaction()?.hash;
    trace(`OracleAdapter (hardened) ${adapterAddr} tx=${out.oracleAdapterTx}`);
  } else trace(`reuse hardened adapter ${adapterAddr}`);
  out.oracleAdapter = adapterAddr;

  let noteAddr = process.env.C6_NOTE ?? "";
  if (!noteAddr || (await ethers.provider.getCode(noteAddr)) === "0x") {
    const NV = await ethers.getContractFactory("ConfidentialNoteV4");
    const nv = await withRetry("deployNote", async () => { const c = await NV.deploy(CUSDT, adapterAddr); await c.waitForDeployment(); return c; });
    noteAddr = await nv.getAddress();
    out.confidentialNoteTx = nv.deploymentTransaction()?.hash;
    trace(`ConfidentialNoteV4 ${noteAddr} tx=${out.confidentialNoteTx}`);
  } else trace(`reuse note ${noteAddr}`);
  out.confidentialNote = noteAddr;

  const usdc = new ethers.Contract(USDC, ["function mint(address,uint256) external", "function approve(address,uint256) external returns (bool)"], me);
  const note = new ethers.Contract(noteAddr, [
    "function issue(address,uint64,uint64,uint64,uint64,bytes32,bytes32,bytes) external returns (uint256)",
    "function settle(uint256) external",
    "function claim(uint256) external",
    "function notes(uint256) view returns (address,address,uint64,uint64,bytes32,bytes32,uint64,uint64,uint64,uint8,bool,bool,bytes32)",
    "function getPayoff(uint256) view returns (bytes32)",
    "function noteCount() view returns (uint256)",
  ], me);
  const adapter = new ethers.Contract(adapterAddr, ["function observe() returns (uint192,uint8)", "function observationCount() view returns (uint256)", "function settlementPrice(uint64,uint64) view returns (uint64,uint8)"], me);

  const P = 1_000_000n, CAP = 50_000_000n, NEED = P + CAP, STRIKE = 1_000_000_000n, LEV = 2n;
  // window: open now, close in 40s. Sample >=2 times inside so settle uses TWAP (mode 0).
  const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  const ws = now, we = now + 90n;

  await withRetry("mint", async () => (await usdc.mint(addr, NEED)).wait());
  await withRetry("approve", async () => (await usdc.approve(noteAddr, NEED)).wait());
  const enc = await withRetry("encrypt", () => fhevm.createEncryptedInput(noteAddr, addr).add64(STRIKE).add64(LEV).encrypt());
  const itx = await withRetry("issue", async () => (await note.issue(addr, P, CAP, ws, we, enc.handles[0], enc.handles[1], enc.inputProof)).wait());
  const id = ((await note.noteCount()) as bigint) - 1n;
  trace(`issued id=${id} window=[${ws},${we}] tx=${itx.hash}`);

  // sample twice with a gap, both inside the 90s window
  await withRetry("observe#0", async () => (await adapter.observe()).wait());
  await sleep(15000);
  await withRetry("observe#1", async () => (await adapter.observe()).wait());
  trace(`observations=${await adapter.observationCount()}`);

  while (BigInt((await ethers.provider.getBlock("latest"))!.timestamp) < we) await sleep(4000);
  const stx = await withRetry("settle", async () => (await note.settle(id)).wait());
  const n = (await note.notes(id)) as any;
  trace(`settle tx=${stx.hash} refEnd=${n[8]} mode=${n[9]} (expect mode 0 TWAP)`);

  const ctx = await withRetry("claim", async () => (await note.claim(id)).wait());
  let hcu: any; try { const i = fhevm.computeTransactionHCU(ctx); hcu = { globalHCU: i.globalHCU, maxHCUDepth: i.maxHCUDepth }; } catch (e) { hcu = null; }
  const ph = (await note.getPayoff(id)) as string;
  const payoff = await withRetry("decrypt", () => fhevm.userDecryptEuint(FhevmType.euint64, ph, noteAddr, me));
  const expected = P + (CAP < LEV * (BigInt(n[8]) - STRIKE) ? CAP : LEV * (BigInt(n[8]) - STRIKE));
  trace(`claim tx=${ctx.hash} payoff=${payoff} expected=${expected} HCU=${JSON.stringify(hcu)}`);

  out.proof = {
    id: id.toString(), issueTx: itx.hash, settleTx: stx.hash, claimTx: ctx.hash,
    refEnd: n[8].toString(), settleMode: Number(n[9]), payoff: payoff.toString(), expected: expected.toString(),
    payoffCorrect: payoff === expected, hcu,
  };
  out.allPass = payoff === expected;
  fs.writeFileSync(OUT, JSON.stringify(out, J, 2));
  trace(`C6_DONE adapter=${adapterAddr} note=${noteAddr} settleMode=${Number(n[9])} payoffCorrect=${payoff === expected}`);
}
main().catch((e) => { trace(`C6_FATAL ${(e?.message ?? e).toString().slice(0, 200)}`); process.exit(1); });
