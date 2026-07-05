"use client";

import { useEffect, useState } from "react";
import styles from "./docs.module.css";
import { shortAddr } from "@/lib/vellum";

const SECTIONS = [
  { group: "Overview", items: [
    { id: "what", label: "What is Vellum" },
    { id: "protocol", label: "The protocol" },
    { id: "why", label: "Why FHE" },
  ] },
  { group: "How it works", items: [
    { id: "payoff", label: "The payoff" },
    { id: "solvency", label: "Solvency" },
    { id: "privacy", label: "Privacy & reveal" },
    { id: "lifecycle", label: "Lifecycle" },
  ] },
  { group: "Reference", items: [
    { id: "contracts", label: "Live contracts" },
    { id: "feeds", label: "Reference feeds" },
    { id: "run", label: "Run it" },
  ] },
];

const ex = (a: string) => `https://sepolia.etherscan.io/address/${a}`;

export function DocsView(props: {
  note: string;
  oracle: string;
  disperse: string;
  registry: string;
  xau: string;
  eth: string;
  btc: string;
}) {
  const short = shortAddr;
  const [active, setActive] = useState("what");

  useEffect(() => {
    const ids = SECTIONS.flatMap((g) => g.items.map((i) => i.id));
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-72px 0px -70% 0px", threshold: 0 },
    );
    ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);

  const sealIcon = <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
  const checkIcon = <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>;

  return (
    <div className={styles.layout}>
      {/* left section nav */}
      <nav className={styles.nav}>
        {SECTIONS.map((g) => (
          <div key={g.group} className={styles.navGroup}>
            <div className={styles.navGroupLabel}>{g.group}</div>
            {g.items.map((it) => (
              <a key={it.id} href={`#${it.id}`} className={`${styles.navLink} ${active === it.id ? styles.active : ""}`}>{it.label}</a>
            ))}
          </div>
        ))}
      </nav>

      {/* content */}
      <div className={styles.content}>
        <span className={styles.eyebrow}><span className={styles.d} />Documentation</span>
        <h1 className={styles.pageTitle}>Vellum — confidential structured notes.</h1>
        <p className={styles.pageLede}>Financial agreements whose terms compute while sealed. Vellum lets an issuer create a note whose strike and leverage stay encrypted on-chain, whose payoff is computed on ciphertext, and which only the holder can decrypt — while anyone can verify it's fully funded.</p>

        <section id="what" className={styles.section}>
          <h2 className={styles.sectionTitle}>What is Vellum</h2>
          <div className={styles.prose}>
            <p>A <b>structured note</b> is a financial agreement: you put in principal, and at maturity you get back principal plus a payoff that depends on how some reference asset (here, gold) moved. Vellum makes that agreement <b>confidential</b> — the terms that define it are encrypted, yet the contract still computes the correct payoff and pays it out.</p>
            <p>It's built on <b>fully homomorphic encryption</b> (FHE) via Zama's FHEVM: math runs directly on encrypted numbers, so a value can be present and computable on-chain while staying unreadable to everyone but its owner.</p>
          </div>
        </section>

        <section id="protocol" className={styles.section}>
          <h2 className={styles.sectionTitle}>The protocol</h2>
          <div className={styles.prose}>
            <p>Three composable steps, each a surface in this app:</p>
            <div className={styles.states}>
              <div className={styles.stateCard}><div className={styles.dot} style={{ background: "var(--cipher-500)" }} /><div className={styles.nm}>Seal</div><div className={styles.desc}>Wrap a public token into its confidential twin (ERC-7984). Same value, sealed balance.</div></div>
              <div className={styles.stateCard}><div className={styles.dot} style={{ background: "var(--cipher-400)" }} /><div className={styles.nm}>Compute</div><div className={styles.desc}>Issue a note. Its payoff settles on encrypted terms — the contract never sees them in the clear.</div></div>
              <div className={styles.stateCard}><div className={styles.dot} style={{ background: "var(--reveal-500)" }} /><div className={styles.nm}>Reveal</div><div className={styles.desc}>The holder decrypts only their own payoff. Everyone else stays sealed.</div></div>
            </div>
          </div>
        </section>

        <section id="why" className={styles.section}>
          <h2 className={styles.sectionTitle}>Why FHE</h2>
          <div className={styles.prose}>
            <p>To compute on a public blockchain, you normally have to <b>expose</b> the agreement — every counterparty can read your strike, your size, your leverage. That's a non-starter for real financial products.</p>
            <p>Vellum keeps the terms encrypted from end to end. The payoff <span className={styles.settle}>still computes correctly</span> while strike and leverage never leave ciphertext. This is a capability that simply didn't exist on public chains before FHE.</p>
          </div>
        </section>

        <section id="payoff" className={styles.section}>
          <h2 className={styles.sectionTitle}>The payoff</h2>
          <div className={styles.prose}>
            <p>Vellum notes are <b>capped call spreads</b> — principal-protected on the downside, with a capped upside:</p>
            <div className={styles.formula}>payoff = principal + <span className="kw">min</span>(cap, leverage · <span className="kw">max</span>(0, refEnd − strike))</div>
            <p><b>principal</b> and <b>cap</b> are public per note — you only need the <em>bound</em> public, never the terms. <b>strike</b> and <b>leverage</b> are encrypted. <b>refEnd</b> is the public reference price at maturity (a Chainlink feed). The whole expression is computed <b>branchless on ciphertext</b> — FHE has no "if" on encrypted values, so both branches are computed and the wrong one is discarded with an encrypted select.</p>
            <div className={styles.callout}>
              <span className={styles.ic}>{checkIcon}</span>
              <span className={styles.body}><b>Overflow is impossible by construction.</b> Inputs are clamped on-chain (leverage ≤ 1e6, delta ≤ 1e12) so every intermediate stays under 2⁶³. There is no encrypted division, and a single 1e6 scale throughout.</span>
            </div>
          </div>
        </section>

        <section id="solvency" className={styles.section}>
          <h2 className={styles.sectionTitle}>Solvency — funded, without revealing terms</h2>
          <div className={styles.prose}>
            <p>The hard problem with confidential derivatives is proving they're funded without exposing them. Vellum's answer: at issuance the reserve is funded to <b>maxPayoff = principal + cap</b> by wrapping real USDC into confidential cUSDT — a public-amount operation that <b>reverts if underfunded</b> (no silent clamp, no phantom credit).</p>
            <div className={styles.formula}><span className="kw">require</span>(reserveFunded ≥ Σ maxPayoff)  <span style={{ color: "var(--text-tertiary)" }}>// publicly checkable, always</span></div>
            <p>Anyone can read the two public accumulators to verify the protocol is solvent — while every individual note's strike and leverage stay sealed. <b>Only the aggregate bound is public; never a single term.</b></p>
          </div>
        </section>

        <section id="privacy" className={styles.section}>
          <h2 className={styles.sectionTitle}>Privacy & the reveal</h2>
          <div className={styles.prose}>
            <p>When a note matures, the holder signs an <b>EIP-712</b> request and decrypts <b>their</b> payoff client-side, through the Zama relayer. The contract authorizes exactly one address — the holder — to decrypt exactly one value — the final payoff. A second wallet is rejected on-chain by the FHEVM access-control list.</p>
            <div className={styles.callout + " " + styles.cipher}>
              <span className={styles.ic}>{sealIcon}</span>
              <span className={styles.body}>The comparison bit, the intermediate delta, the strike, and the leverage are <b>never</b> granted to anyone — leaking any of them would reveal moneyness or terms. Only <span className={styles.warm}>your</span> final payoff is ever revealed, and only to you.</span>
            </div>
          </div>
        </section>

        <section id="lifecycle" className={styles.section}>
          <h2 className={styles.sectionTitle}>Lifecycle</h2>
          <div className={styles.steps}>
            <div className={styles.step}><div className={styles.st}>Issue</div><div className={styles.sd}>Public (principal, cap, settlement window) + encrypted (strike, leverage) as a ZK-proved input. The reserve is funded by wrapping USDC.</div></div>
            <div className={styles.step}><div className={styles.st}>Settle</div><div className={styles.sd}>Permissionless once the window closes. Finalizes the reference price from the oracle — a window TWAP, or the price at maturity if the window went unsampled. Settle-once.</div></div>
            <div className={styles.step}><div className={styles.st}>Claim</div><div className={styles.sd}>Holder-only. Computes the payoff, grants the holder decrypt access, and transfers the encrypted amount out of the reserve via a confidential ERC-7984 transfer.</div></div>
            <div className={styles.step}><div className={styles.st}>Reveal</div><div className={styles.sd}>The holder decrypts their payoff. Confidential distribution can pay a whole set of note-holders at once, each seeing only their own amount.</div></div>
          </div>
        </section>

        <section id="contracts" className={styles.section}>
          <h2 className={styles.sectionTitle}>Live contracts · Sepolia</h2>
          <div className={styles.reftable}>
            <div className={styles.refrow}><span className={styles.k}>ConfidentialNote <span className={styles.verified}>{checkIcon}verified</span></span><a href={ex(props.note)} target="_blank" rel="noreferrer">{short(props.note)} ↗</a></div>
            <div className={styles.refrow}><span className={styles.k}>Oracle adapter (XAU/USD) <span className={styles.verified}>{checkIcon}verified</span></span><a href={ex(props.oracle)} target="_blank" rel="noreferrer">{short(props.oracle)} ↗</a></div>
            <div className={styles.refrow}><span className={styles.k}>Disperse singleton (TokenOps)</span><a href={ex(props.disperse)} target="_blank" rel="noreferrer">{short(props.disperse)} ↗</a></div>
            <div className={styles.refrow}><span className={styles.k}>Confidential-wrapper registry (Zama)</span><a href={ex(props.registry)} target="_blank" rel="noreferrer">{short(props.registry)} ↗</a></div>
          </div>
        </section>

        <section id="feeds" className={styles.section}>
          <h2 className={styles.sectionTitle}>Reference feeds · Chainlink</h2>
          <div className={styles.reftable}>
            <div className={styles.refrow}><span className={styles.k}>XAU / USD (gold — the note's reference leg)</span><a href={ex(props.xau)} target="_blank" rel="noreferrer">{short(props.xau)} ↗</a></div>
            <div className={styles.refrow}><span className={styles.k}>ETH / USD (oracle fallback)</span><a href={ex(props.eth)} target="_blank" rel="noreferrer">{short(props.eth)} ↗</a></div>
            <div className={styles.refrow}><span className={styles.k}>BTC / USD</span><a href={ex(props.btc)} target="_blank" rel="noreferrer">{short(props.btc)} ↗</a></div>
            <div className={styles.refrow}><span className={styles.k}>Confidential disperse total</span><span className={styles.ok}>encrypted on-chain</span></div>
          </div>
        </section>

        <section id="run" className={styles.section}>
          <h2 className={styles.sectionTitle}>Run it</h2>
          <div className={styles.prose}>
            <p>Everything here is live on Sepolia against real on-chain infrastructure — no mocks in the note flow. To try the reveal: connect the note-holder wallet on the <span className={styles.here}>Products</span> page and decrypt the payoff. A wallet that isn't the holder is correctly refused.</p>
            <div className={styles.formula}><span className="kw">cd</span> web && npm install && npm run dev   <span style={{ color: "var(--text-tertiary)" }}># http://localhost:3939</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}
