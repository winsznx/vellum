import { Topbar } from "../Topbar";
import styles from "./registry.module.css";
import { publicClient } from "@/lib/viem";
import { REGISTRY, REGISTRY_ABI, ERC20_ABI, ERC7984_ABI, SEPOLIA_CHAIN_ID, shortAddr } from "@/lib/vellum";

export const revalidate = 60; // re-read the live registry each minute

type Pair = { token: string; conf: string; isValid: boolean; symbol: string; confSymbol: string; decimals: number };

async function readPairs(): Promise<Pair[]> {
  const client = publicClient();
  const raw = (await client.readContract({
    address: REGISTRY[SEPOLIA_CHAIN_ID] as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getTokenConfidentialTokenPairs",
  })) as readonly { tokenAddress: string; confidentialTokenAddress: string; isValid: boolean }[];

  // only surface valid pairs — an invalidated/deprecated pair must not render as a live twin
  return Promise.all(
    raw.filter((p) => p.isValid).map(async (p) => {
      const [symbol, decimals, confSymbol] = await Promise.all([
        client.readContract({ address: p.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "?"),
        client.readContract({ address: p.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
        client.readContract({ address: p.confidentialTokenAddress as `0x${string}`, abi: ERC7984_ABI, functionName: "symbol" }).catch(() => "?"),
      ]);
      return {
        token: p.tokenAddress,
        conf: p.confidentialTokenAddress,
        isValid: p.isValid,
        symbol: String(symbol),
        confSymbol: String(confSymbol),
        decimals: Number(decimals),
      };
    }),
  );
}

const sealIcon = (
  <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);

export default async function RegistryPage() {
  let pairs: Pair[] = [];
  let error: string | null = null;
  try {
    pairs = await readPairs();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <>
      <Topbar crumb={<span className={styles.here}>Registry</span>} />
      <div className={styles.content}>
        <h1 className={styles.h1}>Every asset has a confidential twin.</h1>
        <p className={styles.lead}>Wrap any token in the registry and its balance is sealed on-chain — same value, now readable only by you.</p>
        <div className={styles.regref}>
          <span className={styles.pill}><span className={styles.live} />Live registry</span>
          <span>{pairs.length} pairs · Sepolia</span>
          <span className="mono">{shortAddr(REGISTRY[SEPOLIA_CHAIN_ID])}</span>
        </div>

        <div className={styles.layout}>
          {/* HERO: public -> SEAL -> private */}
          <div className={styles.wrapcard}>
            <div className={`${styles.face} ${styles.public}`}>
              <div className={styles.domain}>Public domain<span className={styles.ln} /></div>
              <div className={styles.facelab}><svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>visible to anyone on-chain</div>
              <div className={styles.pubval}>12,000.00<span className={styles.t}>USDC</span></div>
            </div>
            <div className={styles.seam}>
              <span className={`${styles.seamchev} ${styles.l}`}>▼</span>
              <span className={styles.sealnode}><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" /></svg>Seal</span>
              <span className={`${styles.seamchev} ${styles.r}`}>▼</span>
            </div>
            <div className={`${styles.face} ${styles.confidential}`}>
              <div className={styles.domain}>Private domain<span className={styles.ln} /></div>
              <div className={styles.facelab}>{sealIcon}sealed on-chain · only you can decrypt</div>
              <div className={styles.confval}><span className={styles.ct}>cUSDC</span><span className={styles.sealbig}>▓▓▓▓▓▓</span></div>
              <div className={styles.settle}><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>Sealed · settled</div>
            </div>
            <div className={styles.wrapfoot}>
              <span className={styles.par}>1&nbsp;<b>USDC</b>&nbsp;=&nbsp;1&nbsp;<b>cUSDC</b> · same value, now confidential</span>
              <button className={styles.wrapbtn}>{sealIcon}Seal balance</button>
            </div>
          </div>

          {/* live registry of twins */}
          <div className={styles.regcard}>
            <div className={styles.rh}><span className={styles.t}>Confidential Wrapper Registry</span><span className={styles.c}>{pairs.length} pairs</span></div>
            <div className={styles.thead}><span>Asset</span><span>Confidential twin</span><span>Your balance</span></div>
            {error && <div className={styles.regfoot} style={{ color: "var(--danger-400)" }}>Registry read failed: {error}</div>}
            {pairs.map((p, i) => (
              <div key={p.conf} className={`${styles.trow} ${i === 0 ? styles.on : ""}`}>
                <span className={styles.asset}><span className={`${styles.mk} ${styles.pub}`} />{p.symbol}</span>
                <span className={styles.twin}><span className={styles.arr}>→</span><span className={`${styles.mk} ${styles.twinmk}`}><span className={styles.lk}>{sealIcon}</span></span>{p.confSymbol}</span>
                <span className={styles.bal}><span className={styles.seal}>{sealIcon}▓▓▓▓</span></span>
              </div>
            ))}
            <div className={styles.regfoot}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg>On Sepolia, mint test balances from the cToken faucet to try a wrap.</div>
          </div>
        </div>
      </div>
    </>
  );
}
