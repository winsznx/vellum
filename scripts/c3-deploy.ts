import { ethers, fhevm } from "hardhat";
import * as fs from "fs";
import * as path from "path";

// C3 phase 1: deploy XAU/USD-primary OracleAdapter + ConfidentialNoteV3 (wrap-funded reserve).
const XAU_USD = "0xC5981F461d74c46eB4b0CF3f4Ec79f025573B0Ea"; // gold, live Sepolia
const ETH_USD = "0x694AA1769357215DE4FAC081bf1f309aDC325306"; // fallback (fresh)
const CUSDT_WRAPPER = "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639"; // Confidential USDC (Mock), rate=1, 6dp
const USDC = "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF"; // USD Coin (Mock), mint() faucet, 6dp
const MAX_STALENESS = 3600n;

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
  fs.writeFileSync(TRACE, "");
  trace("C3 deploy phase");
  const [me] = await ethers.getSigners();
  const addr = await me.getAddress();
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw new Error("not sepolia");
  await withRetry("init", () => fhevm.initializeCLIApi());

  const state: any = JSON.parse(fs.existsSync(STATE) ? fs.readFileSync(STATE, "utf8") : "{}");
  state.xau = XAU_USD; state.ethFallback = ETH_USD; state.cUSDT = CUSDT_WRAPPER; state.usdc = USDC; state.issuer = addr;

  if (!state.adapter || (await ethers.provider.getCode(state.adapter)) === "0x") {
    const OA = await ethers.getContractFactory("OracleAdapter");
    const oa = await withRetry("deployAdapter(XAU)", async () => { const c = await OA.deploy(XAU_USD, ETH_USD, MAX_STALENESS); await c.waitForDeployment(); return c; });
    state.adapter = await oa.getAddress(); state.adapterTx = oa.deploymentTransaction()?.hash;
    trace(`OracleAdapter(XAU primary) ${state.adapter} tx=${state.adapterTx}`);
    fs.writeFileSync(STATE, JSON.stringify(state, J, 2));
  } else trace(`reuse adapter ${state.adapter}`);

  if (!state.note || (await ethers.provider.getCode(state.note)) === "0x") {
    const NV = await ethers.getContractFactory("ConfidentialNoteV3");
    const nv = await withRetry("deployNoteV3", async () => { const c = await NV.deploy(CUSDT_WRAPPER, state.adapter); await c.waitForDeployment(); return c; });
    state.note = await nv.getAddress(); state.noteTx = nv.deploymentTransaction()?.hash;
    trace(`ConfidentialNoteV3 ${state.note} tx=${state.noteTx}`);
    fs.writeFileSync(STATE, JSON.stringify(state, J, 2));
  } else trace(`reuse note ${state.note}`);

  fs.writeFileSync(STATE, JSON.stringify(state, J, 2));
  trace(`DEPLOY_DONE adapter=${state.adapter} note=${state.note}`);
}
main().catch((e) => { trace(`FATAL ${(e?.message ?? e).toString().slice(0, 160)}`); process.exit(1); });
