import { Topbar } from "../Topbar";
import styles from "../simple.module.css";

export default function ActivityPage() {
  return (
    <>
      <Topbar crumb={<span className={styles.here}>Activity</span>} />
      <div className={styles.content}>
        <span className={styles.tag}><span className={styles.d} style={{ background: "var(--settle-500)" }} />On-chain activity</span>
        <h1 className={styles.h1}>Settlement &amp; reveal log.</h1>
        <p className={styles.lead}>Wraps, issuances, settlements, claims and confidential disperses appear here as they settle on-chain. Amounts stay sealed; only state transitions are public.</p>
      </div>
    </>
  );
}
