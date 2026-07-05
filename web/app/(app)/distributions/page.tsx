import { Topbar } from "../Topbar";
import styles from "./distributions.module.css";
import { VELLUM_SEPOLIA, shortAddr } from "@/lib/vellum";

// Distributions / verifiable claim — ported verbatim from vellum-screen-verifiable-claim.html.
// The committed total is public; every per-recipient slice stays sealed (C4: encrypted amounts,
// no plaintext total). The hero allocation reveals only to the connected holder via userDecrypt
// (wired identically to Products; shown here as the claimed-state artifact).
const sealIcon = <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;

export default function DistributionsPage() {
  return (
    <>
      <Topbar crumb={<span style={{ color: "var(--text-primary)", fontWeight: 600 }}>Distributions</span>} />
      <div className={styles.view}>
        <div className={styles.wrap}>
          <div className={styles.card}>
            <div className={styles.cardPad}>
              <div className={styles.eyebrow}>
                <span className={styles.drop}>Confidential distribution · /fhe-disperse</span>
                <span className={styles.chip} style={{ color: "var(--cipher-300)", background: "rgba(88,106,140,.14)", border: "1px solid rgba(88,106,140,.3)" }}>
                  <span className={styles.pip} style={{ background: "var(--cipher-400)" }} />Illustration
                </span>
              </div>

              <h1 className={styles.headline}>Only <span className={styles.warm}>your</span> allocation was revealed.</h1>

              <div className={styles.hero}>
                <div className={styles.k}>Your allocation
                  <span className={styles.boundary}><svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 9.9-1" /><rect x="4" y="11" width="14" height="9" rx="2" /></svg>sealed → decrypted by you</span>
                </div>
                <div className={`${styles.val} revealing`}>5.00<span className={styles.u}>cUSDT</span></div>
              </div>

              <div className={styles.confidence}>
                <span className={styles.ck}><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg></span>
                <div className={styles.lines}>
                  <b>Allocation verified</b>
                  <span>Part of the committed distribution — recipient count is public, every slice is sealed.</span>
                  <span>Other allocations remain encrypted. You decrypted only your own.</span>
                </div>
              </div>

              <div className={styles.crowd}>
                <div className={styles.clab}><span>Recipients</span><span className={styles.pub}>2 note-holders · committed total sealed</span></div>
                <div className={styles.list}>
                  <div className={`${styles.row} ${styles.you}`}>
                    <span className={styles.who}><span className={styles.youBadge}>YOU</span><span className={`${styles.addr} ${styles.you}`}>0xA57B…bBd4</span></span>
                    <span className={styles.amtRev}>5.00 cUSDT</span>
                  </div>
                  <div className={styles.row}><span className={styles.who}><span className={`${styles.addr} ${styles.addrSeal}`}>0x▓▓▓▓…▓▓▓▓</span></span><span className={styles.seal}>{sealIcon}▓▓▓▓</span></div>
                  <div className={styles.morerow}><span className={styles.sealMini}>▓▓▓</span> committed total &amp; other slices — sealed on-chain</div>
                </div>
              </div>
            </div>

            <div className={styles.foot}>
              <div className={styles.enc}>{sealIcon}Amounts &amp; committed total stay encrypted on-chain.</div>
              <div className={styles.actions}>
                <a className={styles.expl} href={`https://sepolia.etherscan.io/address/${VELLUM_SEPOLIA.disperseSingleton}`} target="_blank" rel="noreferrer">{shortAddr(VELLUM_SEPOLIA.disperseSingleton)} ↗</a>
                <span className={styles.btnDone}><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>Claimed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
