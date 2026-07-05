import Link from "next/link";
import "./landing.css";

// Landing — ported verbatim from vellum-landing-v2.html. Markup unchanged; href="#start"
// anchors preserved, primary CTAs route into the app shell at /registry.
export default function LandingPage() {
  return (
    <div className="landing" data-theme="light">
      {/* NAV */}
      <div className="navbar"><div className="pill">
        <div className="brand"><span className="mark" /><b>Vellum</b></div>
        <span className="tick" />
        <nav><a href="#seal">Seal</a><a href="#compute">Compute</a><a href="#reveal">Reveal</a><Link href="/docs">Docs</Link></nav>
        <span className="tick" />
        <div className="soc">
          <a href="#" aria-label="X"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></a>
          <a href="#" aria-label="GitHub"><svg viewBox="0 0 24 24"><path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.42.36.8 1.08.8 2.18v3.23c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" /></svg></a>
        </div>
        <Link className="cta" href="/registry">Start sealing assets <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
      </div></div>

      {/* HERO */}
      <section className="hero dots"><div className="wrap">
        <span className="htag"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>Composable confidential finance</span>
        <h1>Financial agreements that compute <span className="mut">while encrypted.</span></h1>
        <p className="hsub">Terms stay sealed on-chain — they compute and settle without ever being revealed, and only you can unlock your own outcome.</p>
        <div className="hcta">
          <Link className="cta big" href="/registry">Start sealing assets <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link>
          <span className="note">Live on Ethereum &amp; Sepolia</span>
        </div>

        <div className="proto">
          <div className="eyebrow">The protocol, in one line</div>
          <div className="flow">
            <div className="stage asset"><div className="ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg></div><div className="nm">Asset</div><div className="sub">public</div></div>
            <div className="conn" />
            <div className="stage sealed"><div className="ico"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg></div><div className="nm">Sealed</div><div className="sub">▓▓▓▓</div></div>
            <div className="conn" />
            <div className="stage computed"><div className="ico"><svg viewBox="0 0 24 24"><path d="M5 7l4 5-4 5M11 17h8" /></svg></div><div className="nm">Computed</div><div className="sub">on ciphertext</div></div>
            <div className="conn warm" />
            <div className="stage revealed"><div className="ico"><svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg></div><div className="nm">Revealed</div><div className="sub">only to you</div></div>
          </div>
        </div>
      </div></section>

      {/* 01 SEAL */}
      <section className="feat" id="seal"><div className="wrap split">
        <div className="copy">
          <span className="slabel"><span className="d cipher" />01 — Seal · Registry</span>
          <h2 className="idea">Every asset has a <span className="cipher">confidential twin.</span></h2>
          <p className="icap">Wrap any token in the registry and its balance is sealed on-chain — same value, readable only by you.</p>
        </div>
        <div className="frame">
          <div className="fbar"><span className="l">Registry</span><span className="net">Ethereum</span></div>
          <div className="fbody">
            <div className="domlab" style={{ color: "var(--slate-500)" }}>Public domain</div>
            <div className="mono" style={{ fontSize: 21, color: "var(--slate-300)" }}>12,000.00 <span style={{ fontSize: 12, color: "var(--slate-500)" }}>USDC</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
              <span style={{ flex: 1, height: 1, background: "repeating-linear-gradient(90deg,rgba(131,144,172,.4) 0 6px,transparent 6px 12px)" }} />
              <span className="seal" style={{ fontWeight: 700 }}><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>SEAL</span>
              <span style={{ flex: 1, height: 1, background: "repeating-linear-gradient(90deg,rgba(131,144,172,.4) 0 6px,transparent 6px 12px)" }} />
            </div>
            <div className="domlab" style={{ color: "var(--cipher-400)" }}>Private domain</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 13 }}><span className="mono" style={{ fontSize: 14, color: "var(--cipher-300)" }}>cUSDC</span><span className="mono" style={{ fontSize: 52, color: "var(--cipher-400)", letterSpacing: ".08em", textShadow: "0 0 26px rgba(88,106,140,.4)" }}>▓▓▓▓▓</span></div>
            <div style={{ marginTop: 16 }}><span className="chip-set"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>Sealed · settled</span></div>
          </div>
        </div>
      </div></section>

      {/* 02 COMPUTE */}
      <section className="feat" id="compute"><div className="wrap split rev">
        <div className="frame">
          <div className="fbar"><span className="l">Products / Gold-Linked PPN</span><span className="net">Ethereum</span></div>
          <div className="fbody">
            <div className="cpk">Your payoff · computed while every term stayed encrypted</div>
            <div className="cbignum warmval">1,284.50<span className="cu">cUSDT</span></div>
            <div className="depsupport">
              <div className="cap">computed from sealed terms</div>
              <div className="deprow">
                <span className="dep"><span>Strike</span><span className="seal"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>▓▓▓</span></span>
                <span className="dep"><span>Leverage</span><span className="seal"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>▓▓</span></span>
                <span className="dep"><span>Notional</span><span className="seal"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>▓▓▓</span></span>
              </div>
            </div>
          </div>
        </div>
        <div className="copy">
          <span className="slabel"><span className="d warm" />02 — Compute · Products</span>
          <h2 className="idea">It computes <span className="warm">without revealing its terms.</span></h2>
          <p className="icap">Strike, leverage, notional — all encrypted. The payoff is calculated on ciphertext and unlocks only for the holder.</p>
        </div>
      </div></section>

      {/* 03 REVEAL */}
      <section className="feat" id="reveal"><div className="wrap split">
        <div className="copy">
          <span className="slabel"><span className="d warm" />03 — Reveal · Distributions</span>
          <h2 className="idea">Only <span className="warm">your</span> allocation is revealed.</h2>
          <p className="icap">Verify your slice against the public committed total — every other amount and the recipient list stay sealed.</p>
        </div>
        <div className="frame">
          <div className="fbar"><span className="l">Distribution · claim</span><span className="net">Ethereum</span></div>
          <div className="fbody">
            <div style={{ fontSize: 12, color: "var(--slate-500)", marginBottom: 4 }}>Your allocation</div>
            <div className="alloc"><span className="warmval big">4,250.00<span className="u">cUSDT</span></span><span className="chip-set"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5" /></svg>Verified</span></div>
            <div className="rrow you"><span><span className="you-b">YOU</span>0x9a3f…7c1f</span><span className="amt">4,250.00 cUSDT</span></div>
            <div className="rrow"><span className="a">0x▓▓▓▓…▓▓▓▓</span><span className="seal" style={{ padding: "1px 7px" }}><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>▓▓▓▓</span></div>
            <div className="rrow"><span className="a">0x▓▓▓▓…▓▓▓▓</span><span className="seal" style={{ padding: "1px 7px" }}><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>▓▓▓▓▓</span></div>
            <div className="rmore">+ 37 more recipients — sealed</div>
          </div>
        </div>
      </div></section>

      {/* COMPOSITION */}
      <section className="feat"><div className="wrap"><div className="band">
        <div className="toplabel">The protocol</div>
        <div className="stack">
          <div className="gverb s">Seal<span className="cap">Registry · wrap into a confidential twin</span><span className="gstate sealed">▓▓▓▓▓▓</span></div>
          <div className="garrow"><svg viewBox="0 0 24 24"><path d="M12 3v18M5 14l7 7 7-7" /></svg></div>
          <div className="gverb c">Compute<span className="cap">Products · settle on ciphertext</span><span className="gstate sealed">▓▓▓▓▓▓ <span className="tiny">computing on encrypted data</span></span></div>
          <div className="garrow warm"><svg viewBox="0 0 24 24"><path d="M12 3v18M5 14l7 7 7-7" /></svg></div>
          <div className="gverb r">Reveal<span className="cap">Distributions · unlock only your own</span><span className="gstate warm">1,284.50 cUSDT</span></div>
        </div>
      </div></div></section>

      {/* WHY FHE */}
      <section className="feat"><div className="wrap">
        <span className="slabel"><span className="d cipher" />Why this couldn&apos;t exist before</span>
        <h2 className="idea" style={{ maxWidth: "24ch" }}>To compute on a public chain, you had to expose the agreement.</h2>
        <div className="why">
          <div className="wbox legible">
            <div className="h">Public chain</div>
            <div className="line"><span>Strike</span><span className="exposed">2,400.00</span></div>
            <div className="line"><span>Leverage</span><span className="exposed">3.0×</span></div>
            <div className="line"><span>Notional</span><span className="exposed">1,000,000</span></div>
            <div className="line"><span>Every counterparty</span><span className="exposed">can read it</span></div>
          </div>
          <div className="wbox sealedbox">
            <div className="h">Vellum · FHE</div>
            <div className="line"><span>Strike</span><span className="seal" style={{ padding: "1px 7px" }}>▓▓▓▓</span></div>
            <div className="line"><span>Leverage</span><span className="seal" style={{ padding: "1px 7px" }}>▓▓</span></div>
            <div className="line"><span>Notional</span><span className="seal" style={{ padding: "1px 7px" }}>▓▓▓▓▓</span></div>
            <div className="line"><span>The payoff still computes</span><span style={{ color: "var(--settle-400)" }}>✓ correct</span></div>
          </div>
        </div>
      </div></section>

      {/* FOOTER CARD */}
      <footer className="foot" id="start"><div className="wrap"><div className="footcard dots" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,.04) 1.4px,transparent 1.5px)" }}>
        <div className="verbs"><span className="s">Seal.</span><span className="c">Compute.</span><span className="r">Reveal.</span></div>
        <h2>Issue your first confidential agreement.</h2>
        <p>Wrap an asset, structure a product, settle it sealed. Live on Ethereum and Sepolia.</p>
        <div className="fcta"><Link className="cta" href="/registry" style={{ padding: "14px 26px", fontSize: "15.5px" }}>Start sealing assets <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></Link></div>

        <div className="fgrid">
          <div>
            <div className="fbrand"><span className="mark" /><b>Vellum</b></div>
            <div className="flinks" style={{ marginTop: 18 }}><a href="#seal">Seal</a><a href="#compute">Compute</a><a href="#reveal">Reveal</a><Link href="/docs">Docs</Link><a href="#">GitHub</a></div>
            <div className="fmeta">Composable confidential finance · Built on Zama FHEVM</div>
          </div>
          <div className="fsoc">
            <a href="#" aria-label="X"><svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></a>
            <a href="#" aria-label="GitHub"><svg viewBox="0 0 24 24"><path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.76.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.69 5.41-5.25 5.69.42.36.8 1.08.8 2.18v3.23c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" /></svg></a>
          </div>
        </div>
      </div></div></footer>
    </div>
  );
}
