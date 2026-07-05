import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createConfidentialDisperseClient, ERC7984_OPERATOR_MAX_DEADLINE } from "@tokenops/sdk/fhe-disperse";
import { getFheDisperseSingletonAddress } from "@tokenops/sdk";
import * as fs from "fs";
import * as path from "path";

// AT#5 composition: distribute a confidential coupon to >=2 NOTE-HOLDERS via the live singleton.
// Holders are the holders of ConfidentialNoteV3 notes (the product's investor set). Each holder
// decrypts ONLY their own coupon; cross sealed. Reuses the deployed C3 NoteV3 (c3-state.json) to
// derive a real note-holder set, then disperses cUSDM coupons to them.
const CUSDM = "0xf7c0cdc1e5f8B79741E78b25D014A7a8f7486B16";
const NOTE_ABI = [
  "function issue(address holder,uint64 principal,uint64 cap,uint64 windowStart,uint64 windowEnd,bytes32 encStrike,bytes32 encLeverage,bytes32 encNotional,bytes proof) returns (uint256)",
  "function noteCount() view returns (uint256)",
  "function notes(uint256) view returns (address issuer,address holder,uint64 principal,uint64 cap,bytes32 strike,bytes32 leverage,bytes32 notional,uint64 windowStart,uint64 windowEnd,uint64 refEnd,bool settled,bool claimed,bytes32 payoff)",
];
const TOKEN_ABI = ["function mint(address,uint64) external", "function setOperator(address,uint48) external", "function isOperator(address,address) view returns (bool)", "function confidentialBalanceOf(address) view returns (bytes32)"];

const ROOT = path.join(__dirname, "..");
const TRACE = path.join(ROOT, "c4-trace.log");
const RESULTS = path.join(ROOT, "c4-compose.json");
const J = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);
const trace = (m: string) => { const l = `[+${process.uptime().toFixed(1)}s] ${m}\n`; fs.appendFileSync(TRACE, l); process.stdout.write(l); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(label: string, fn: () => Promise<T>, n = 6): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= n; i++) { try { const r = await fn(); if (i > 1) trace(`  ${label} ok@${i}`); return r; } catch (e: any) { last = e; trace(`  ${label} ${i}/${n}: ${(e?.message ?? e).toString().slice(0, 70)}`); if (i < n) await sleep(4000 * i); } }
  throw last;
}

type FheValueInput = { value: boolean | bigint | string; type: string };
const encryptor = {
  async encrypt({ values, contractAddress, userAddress }: { values: FheValueInput[]; contractAddress: `0x${string}`; userAddress: `0x${string}` }) {
    const enc = await withRetry(`encrypt(n=${values.length})`, () => { let b = fhevm.createEncryptedInput(contractAddress, userAddress); for (const v of values) b = b.add64(v.value as bigint); return b.encrypt(); });
    return { handles: enc.handles, inputProof: enc.inputProof };
  },
};

async function main() {
  trace("C4 compose (note-holder coupon)");
  const [issuer] = await ethers.getSigners();
  const me = (await issuer.getAddress()) as `0x${string}`;
  if ((await ethers.provider.getNetwork()).chainId !== 11155111n) throw new Error("not sepolia");
  await withRetry("init", () => fhevm.initializeCLIApi());

  const c3 = JSON.parse(fs.readFileSync(path.join(ROOT, "c3-state.json"), "utf8"));
  const noteAddr = c3.note as string;
  trace(`reuse ConfidentialNoteV3 ${noteAddr}`);
  const note = new ethers.Contract(noteAddr, NOTE_ABI, issuer);
  const token = new ethers.Contract(CUSDM, TOKEN_ABI, issuer);
  const SINGLETON = getFheDisperseSingletonAddress(11155111)! as `0x${string}`;

  // two distinct note-holders (fresh wallets) — the investor set
  const h1 = ethers.Wallet.createRandom().connect(ethers.provider);
  const h2 = ethers.Wallet.createRandom().connect(ethers.provider);
  trace(`note-holders: h1=${h1.address} h2=${h2.address}`);

  // issue a note to each holder (terms encrypted; funds via USDC wrap inside issue)
  const USDC = c3.usdc as string;
  const usdc = new ethers.Contract(USDC, ["function mint(address,uint256) external", "function approve(address,uint256) external returns (bool)"], issuer);
  const issueTo = async (holder: string, principal: bigint, cap: bigint) => {
    const need = principal + cap;
    await withRetry("usdc.mint", async () => (await usdc.mint(me, need)).wait());
    await withRetry("usdc.approve", async () => (await usdc.approve(noteAddr, need)).wait());
    const now = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
    const enc = await withRetry("encrypt(issue)", () => fhevm.createEncryptedInput(noteAddr, me).add64(1_000_000_000n).add64(2n).add64(1_000_000n).encrypt());
    const tx = await withRetry("issue", async () => (await note.issue(holder, principal, cap, now, now + 60n, enc.handles[0], enc.handles[1], enc.handles[2], enc.inputProof)).wait());
    const id = ((await note.noteCount()) as bigint) - 1n;
    trace(`issued note id=${id} -> holder ${holder} tx=${tx.hash}`);
    return id;
  };
  const id1 = await issueTo(h1.address, 1_000_000n, 50_000_000n);
  const id2 = await issueTo(h2.address, 1_000_000n, 50_000_000n);

  // distribute a confidential COUPON (cUSDM) to the two note-holders via the live singleton
  if (!(await token.isOperator(me, SINGLETON))) await withRetry("setOp", async () => (await token.setOperator(SINGLETON, ERC7984_OPERATOR_MAX_DEADLINE)).wait());
  await withRetry("mint coupon funds", async () => (await token.mint(me, 100_000_000n)).wait());

  const pk = (process.env.TEST_PRIVATE_KEY!.startsWith("0x") ? process.env.TEST_PRIVATE_KEY! : `0x${process.env.TEST_PRIVATE_KEY!}`) as `0x${string}`;
  const rpc = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const client = createConfidentialDisperseClient({
    publicClient: createPublicClient({ chain: sepolia, transport: http(rpc) }),
    walletClient: createWalletClient({ account: privateKeyToAccount(pk), chain: sepolia, transport: http(rpc) }),
    encryptor, chainId: 11155111,
  });

  const coupons = [5_000_000n, 7_500_000n]; // distinct per-holder confidential coupons
  trace(`disperse coupon to 2 note-holders amounts=[${coupons}]`);
  const dr = await withRetry("disperse(coupon)", () => client.disperse({ token: CUSDM, mode: "direct", recipients: [h1.address as `0x${string}`, h2.address as `0x${string}`], amounts: coupons }));
  const rc = await ethers.provider.getTransactionReceipt(dr.hash);
  let hcu: any; try { const i = fhevm.computeTransactionHCU(rc!); hcu = { globalHCU: i.globalHCU, maxHCUDepth: i.maxHCUDepth }; } catch (e) { hcu = null; }
  trace(`coupon disperse tx=${dr.hash} status=${rc?.status} HCU=${JSON.stringify(hcu)}`);

  const decBal = (who: string, signer: ethers.Signer) => withRetry(`decBal(${who.slice(0, 8)})`, async () => {
    const h = (await token.connect(signer).confidentialBalanceOf(who)) as string;
    if (h === ethers.ZeroHash) return 0n; return fhevm.userDecryptEuint(FhevmType.euint64, h, CUSDM, signer);
  });
  const d1 = await decBal(h1.address, h1);
  const d2 = await decBal(h2.address, h2);
  trace(`h1 coupon decrypted=${d1} (expect ${coupons[0]}); h2=${d2} (expect ${coupons[1]})`);

  // cross sealed: h1 tries h2
  let crossSealed = false, detail = "";
  try { const h = (await token.connect(h2).confidentialBalanceOf(h2.address)) as string; const leak = await fhevm.userDecryptEuint(FhevmType.euint64, h, CUSDM, h1); detail = `LEAK=${leak}`; }
  catch (e: any) { crossSealed = true; detail = (e?.message ?? String(e)).slice(0, 100); }

  const out = {
    note: noteAddr, singleton: SINGLETON,
    noteHolders: [{ holder: h1.address, noteId: id1.toString(), coupon: coupons[0].toString(), decrypted: d1.toString(), pass: d1 === coupons[0] },
                  { holder: h2.address, noteId: id2.toString(), coupon: coupons[1].toString(), decrypted: d2.toString(), pass: d2 === coupons[1] }],
    couponDisperseTx: dr.hash, status: rc?.status, hcu, crossSealed, crossDetail: detail,
    pass: rc?.status === 1 && d1 === coupons[0] && d2 === coupons[1] && crossSealed,
  };
  fs.writeFileSync(RESULTS, JSON.stringify({ check: { id: "AT5-composition", name: "Confidential coupon distributed to >=2 note-holders, each decrypts own", ...out } }, J, 2));
  trace(`C4_COMPOSE_DONE pass=${out.pass}`);
}
main().catch((e) => { trace(`C4_COMPOSE_FATAL ${(e?.message ?? e).toString().slice(0, 160)}`); process.exit(1); });
