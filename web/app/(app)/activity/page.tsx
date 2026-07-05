import { Topbar } from "../Topbar";
import styles from "../simple.module.css";
import { publicClient } from "@/lib/viem";
import { VELLUM_SEPOLIA, NOTE_ABI, shortAddr } from "@/lib/vellum";

export const revalidate = 30;

type Entry = { kind: "Issued" | "Settled" | "Claimed"; id: string; detail: string };

// Derive activity from the note state itself (eth_call), not event logs — public RPCs commonly disable
// eth_getLogs, but notes(i) always works. Each note contributes its lifecycle stages in order.
async function readActivity(): Promise<Entry[]> {
  try {
    const client = publicClient();
    const note = VELLUM_SEPOLIA.confidentialNoteV3 as `0x${string}`;
    const count = (await client.readContract({ address: note, abi: NOTE_ABI, functionName: "noteCount" })) as bigint;
    const n = Number(count);
    const out: Entry[] = [];
    for (let i = Math.max(0, n - 12); i < n; i++) {
      const d = (await client.readContract({ address: note, abi: NOTE_ABI, functionName: "notes", args: [BigInt(i)] })) as readonly unknown[];
      const id = String(i);
      const holder = d[1] as string;
      const cap = d[3] as bigint;
      const principal = d[2] as bigint;
      const refEnd = d[8] as bigint;
      const mode = Number(d[9] as number);
      const settled = d[10] as boolean;
      const claimed = d[11] as boolean;
      out.push({ kind: "Issued", id, detail: `holder ${shortAddr(holder)} · maxPayoff ${(Number(principal + cap) / 1e6).toLocaleString()} cUSDT` });
      if (settled) out.push({ kind: "Settled", id, detail: `refEnd ${(Number(refEnd) / 1e6).toLocaleString()} · ${mode === 0 ? "TWAP" : "spot"}` });
      if (claimed) out.push({ kind: "Claimed", id, detail: `payoff decrypted to holder ${shortAddr(holder)}` });
    }
    // newest note first, and within a note: claimed → settled → issued
    return out.reverse();
  } catch {
    return [];
  }
}

export default async function ActivityPage() {
  const entries = await readActivity();
  return (
    <>
      <Topbar crumb={<span className={styles.here}>Activity</span>} />
      <div className={styles.content}>
        <span className={styles.tag}><span className={styles.d} style={{ background: "var(--settle-500)" }} />On-chain activity</span>
        <h1 className={styles.h1}>Settlement &amp; reveal log.</h1>
        <p className={styles.lead}>Live note events from the deployed contract — issuances, settlements, and claims. Amounts stay sealed; only state transitions and the public bound are on-chain.</p>

        {entries.length === 0 ? (
          <div className={styles.emptyCard}>
            <div className={styles.ei}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 8v4l3 2" /></svg></div>
            <div className={styles.et}>No recent activity</div>
            <div className={styles.ed}>Issue, settle, or claim a note and it appears here as it settles on-chain.</div>
          </div>
        ) : (
          <div className={styles.log}>
            {entries.map((e, i) => (
              <div key={e.id + e.kind + i} className={styles.logRow}>
                <span className={`${styles.logKind} ${styles[e.kind.toLowerCase()]}`}>{e.kind}</span>
                <span className={styles.logMeta}>Note <span className="mono">#{e.id}</span> · {e.detail}</span>
                <a className={styles.logTx} href={`https://sepolia.etherscan.io/address/${VELLUM_SEPOLIA.confidentialNoteV3}`} target="_blank" rel="noreferrer">on-chain ↗</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
