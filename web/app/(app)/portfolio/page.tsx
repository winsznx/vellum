import { Topbar } from "../Topbar";
import styles from "../simple.module.css";
import { publicClient } from "@/lib/viem";
import { REGISTRY, REGISTRY_ABI, ERC7984_ABI, SEPOLIA_CHAIN_ID } from "@/lib/vellum";

export const revalidate = 60;

const sealIcon = <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;

async function readConfTokens(): Promise<{ symbol: string }[]> {
  try {
    const client = publicClient();
    const raw = (await client.readContract({
      address: REGISTRY[SEPOLIA_CHAIN_ID] as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "getTokenConfidentialTokenPairs",
    })) as readonly { confidentialTokenAddress: string }[];
    return Promise.all(
      raw.slice(0, 6).map(async (p) => ({
        symbol: String(await client.readContract({ address: p.confidentialTokenAddress as `0x${string}`, abi: ERC7984_ABI, functionName: "symbol" }).catch(() => "cToken")),
      })),
    );
  } catch {
    return [];
  }
}

export default async function PortfolioPage() {
  const tokens = await readConfTokens();
  return (
    <>
      <Topbar crumb={<span className={styles.here}>Portfolio</span>} />
      <div className={styles.content}>
        <span className={styles.tag}><span className={styles.d} style={{ background: "var(--cipher-500)" }} />Your confidential positions</span>
        <h1 className={styles.h1}>Every balance you hold is sealed.</h1>
        <p className={styles.lead}>Your confidential token balances live on-chain as ciphertext. Connect your wallet and decrypt any position locally — no balance is ever a placeholder; a seal stays sealed until you sign.</p>
        <div className={styles.cards}>
          {tokens.map((t) => (
            <div key={t.symbol} className={styles.card}>
              <div className={styles.ct}>{t.symbol}</div>
              <div className={styles.nm}>Confidential balance</div>
              <div className={styles.bal}>
                <span className={styles.k}>Your holdings</span>
                <span className={styles.seal}>{sealIcon}▓▓▓▓</span>
              </div>
            </div>
          ))}
          {tokens.length === 0 && <div className={styles.card}><div className={styles.nm}>Registry unavailable</div><p className={styles.k} style={{ marginTop: 8 }}>Could not read the live registry. Retry shortly.</p></div>}
        </div>
      </div>
    </>
  );
}
