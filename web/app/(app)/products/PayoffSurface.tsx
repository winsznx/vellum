"use client";

import { useState } from "react";
import { useAccount, useConnectorClient, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import styles from "./products.module.css";
import { ZERO_HANDLE, shortAddr } from "@/lib/vellum";

const sealIcon = <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
const eyeIcon = <svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>;

// Chart frame geometry (viewBox 0 0 580 360)
const X0 = 60, X1 = 540, Y_FLOOR = 260, Y_CEIL = 96; // floor (principal) / ceiling (principal+cap) y-positions
const X_STRIKE = 300; // sealed bend x (strike position stays hidden — purely indicative)
const X_CAP_KNEE = 470; // x where the slope reaches the cap ceiling

type Props = {
  principal6: string; // 1e6-scaled, as string (server-safe)
  cap6: string;
  refEndUsd: string;
  payoffHandle: string;
  claimed: boolean;
  settled: boolean;
  noteContract: string;
};

export function PayoffSurface(props: Props) {
  const { payoffHandle, noteContract } = props;
  const principal = Number(props.principal6) / 1e6;
  const cap = Number(props.cap6) / 1e6;
  const floor = principal;
  const ceil = principal + cap; // band ceiling = principal + cap (live)

  const [state, setState] = useState<"sealed" | "revealing" | "revealed" | "error">("sealed");
  const [payoff, setPayoff] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { isConnected, chainId } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== sepolia.id;

  const neverClaimed = !payoffHandle || payoffHandle === ZERO_HANDLE;

  // map a payoff value to chart y within [floor, ceil] -> [Y_FLOOR, Y_CEIL]
  const payoffToY = (v: number) => {
    const frac = ceil > floor ? (v - floor) / (ceil - floor) : 0;
    const clamped = Math.max(0, Math.min(1, frac));
    return Y_FLOOR - clamped * (Y_FLOOR - Y_CEIL);
  };

  const onReveal = async () => {
    setState("revealing");
    setError(null);
    try {
      // Use the wallet RainbowKit/wagmi connected (its EIP-1193 transport), not window.ethereum.
      const transport = connectorClient?.transport as { request?: unknown } | undefined;
      if (!transport?.request) throw new Error("Wallet not connected. Connect the holder wallet on Sepolia to reveal your payoff.");
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(transport as never);
      const { revealHandle } = await import("@/lib/fhe");
      const { cleartext } = await revealHandle({ handle: payoffHandle, contractAddress: noteContract, provider });
      setPayoff(Number(cleartext) / 1e6);
      setState("revealed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // The ACL rejection (non-holder wallet) surfaces here — surface it plainly, not as a crash.
      setError(/not authorized|acl|user decrypt/i.test(msg) ? "This wallet is not the note holder — the payoff stays sealed to you." : msg);
      setState("error");
    }
  };

  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const revealed = state === "revealed" && payoff !== null;
  const warmY = revealed ? payoffToY(payoff!) : Y_CEIL;
  // x for the realized point: cap segment (post-knee) when payoff is at/near the ceiling, else on the slope
  const warmX = revealed && payoff! >= ceil - 1e-9 ? 500 : 430;

  return (
    <div className={styles.grid}>
      {/* PAYOFF CHART — capped call spread, bounds driven by live principal/cap */}
      <div className={styles.card}>
        <div className={styles.cardH}>
          <span className={styles.t}>Payoff</span>
          <span className={styles.encnote}>{sealIcon}computed on encrypted terms</span>
        </div>
        <div className={styles.chartwrap}>
          <svg className={styles.payoff} viewBox="0 0 580 360" role="img" aria-label="Capped call-spread payoff curve">
            {/* grid */}
            <g stroke="rgba(255,255,255,.05)" strokeWidth="1">
              <line x1={X0} y1="60" x2={X1} y2="60" /><line x1={X0} y1="120" x2={X1} y2="120" />
              <line x1={X0} y1="180" x2={X1} y2="180" /><line x1={X0} y1="220" x2={X1} y2="220" />
            </g>
            <line x1={X0} y1="40" x2={X0} y2={Y_FLOOR + 60} stroke="rgba(255,255,255,.16)" />
            <line x1={X0} y1={Y_FLOOR + 60} x2={X1} y2={Y_FLOOR + 60} stroke="rgba(255,255,255,.16)" />

            {/* FLOOR bound — principal · protected (settle teal) */}
            <line x1={X0} y1={Y_FLOOR} x2={X1} y2={Y_FLOOR} stroke="var(--settle-500)" strokeWidth="1.5" strokeDasharray="5 5" opacity=".8" />
            <text className={styles.tickrev} x={X0 + 4} y={Y_FLOOR - 6} fill="var(--settle-400)">Principal · protected · {fmt(floor)}</text>
            {/* CEILING bound — cap (neutral; NOT warm pre-reveal) */}
            <line x1={X0} y1={Y_CEIL} x2={X1} y2={Y_CEIL} stroke="var(--slate-500)" strokeWidth="1.5" strokeDasharray="5 5" opacity=".7" />
            <text className={styles.tickrev} x={X0 + 4} y={Y_CEIL - 6} fill="var(--slate-300)">Cap · {fmt(ceil)}</text>

            {/* sealed strike tick — bend x stays hidden */}
            <line x1={X_STRIKE} y1={Y_FLOOR} x2={X_STRIKE} y2={Y_FLOOR + 60} stroke="var(--cipher-500)" strokeWidth="1" strokeDasharray="3 4" />
            <g transform={`translate(${X_STRIKE},${Y_FLOOR + 78})`}>
              <rect x="-34" y="-13" width="68" height="20" rx="5" fill="rgba(88,106,140,.16)" stroke="rgba(88,106,140,.3)" />
              <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill="var(--cipher-400)" fontFamily="var(--font-mono)" fontSize="11" letterSpacing="2">▓▓▓</text>
            </g>
            <text className={styles.axislab} x={X_STRIKE - 38} y={Y_FLOOR + 83} textAnchor="end">strike</text>

            {/* capped call-spread curve: flat FLOOR -> SLOPE from strike -> flat CEILING (cap). Neutral until reveal. */}
            <path d={`M${X0} ${Y_FLOOR} L${X_STRIKE} ${Y_FLOOR} L${X_CAP_KNEE} ${Y_CEIL} L${X1} ${Y_CEIL}`} fill="none" stroke="var(--slate-400)" strokeWidth="2" />

            {/* realized point */}
            {!revealed && !neverClaimed && (
              // sealed: on the cap segment, value hidden (cipher)
              <>
                <circle cx="500" cy={Y_CEIL} r="5.5" className={styles.sealedPoint} stroke="var(--ink-950)" strokeWidth="1.5" />
                <g transform={`translate(420,${Y_CEIL - 30})`}>
                  <rect x="0" y="0" width="120" height="26" rx="6" fill="var(--ink-800)" stroke="rgba(88,106,140,.3)" />
                  <text x="10" y="17" fill="var(--cipher-400)" fontFamily="var(--font-mono)" fontSize="12" letterSpacing="2">▓▓▓ cUSDT</text>
                </g>
              </>
            )}
            {revealed && (
              // revealed: warm point lands at the decrypted payoff (cap binds -> on the ceiling)
              <g className={styles.revealPoint}>
                <circle cx={warmX} cy={warmY} r="13" fill="rgba(236,166,58,.18)" />
                <circle cx={warmX} cy={warmY} r="5.5" fill="var(--reveal-400)" stroke="var(--ink-950)" strokeWidth="1.5" />
              </g>
            )}
            {revealed && (
              <g className={styles.revealCallout} transform={`translate(${warmX - 150},${warmY - 14})`}>
                <rect className={styles.calloutBg} x="0" y="0" width="140" height="44" rx="8" />
                <text className={styles.calloutK} x="12" y="18">Your payoff</text>
                <text className={styles.calloutV} x="12" y="37">{fmt(payoff!)}<tspan fontSize="11" fill="var(--reveal-300)"> cUSDT</tspan></text>
              </g>
            )}

            {/* public reference (XAU at maturity) */}
            <text className={styles.axislab} x={(X0 + X1) / 2} y={Y_FLOOR + 96} textAnchor="middle">Gold (XAU {props.refEndUsd}) reference at maturity — public</text>
          </svg>
        </div>
      </div>

      {/* RIGHT: position (live reveal, same state) + sealed terms */}
      <div className={styles.rcol}>
        <div className={`${styles.card} ${styles.pos}`}>
          <div className={styles.k}>Your payoff</div>
          {neverClaimed ? (
            <>
              <div className={styles.payoffSealed}>▓▓▓▓▓▓</div>
              <div className={styles.revtag} style={{ color: "var(--cipher-400)" }}>{sealIcon}Not yet claimed — payoff is sealed on-chain</div>
            </>
          ) : revealed ? (
            <>
              <div className={`${styles.payoffV} revealing`}>{fmt(payoff!)}<span className={styles.u}>cUSDT</span></div>
              <div className={styles.revtag}>{eyeIcon}Decrypted for you · sealed for everyone else</div>
              {payoff! >= ceil - 1e-9 && <div className={styles.revtag} style={{ color: "var(--reveal-300)" }}>Cap binds — payoff at the ceiling ({fmt(ceil)})</div>}
            </>
          ) : (
            <>
              <div className={styles.payoffSealed}>▓▓▓▓▓▓</div>
              {!isConnected ? (
                <div className={styles.connectRow}><ConnectButton label="Connect wallet to reveal" /></div>
              ) : wrongChain ? (
                <button className={styles.revealBtn} onClick={() => switchChain({ chainId: sepolia.id })}>
                  {eyeIcon}Switch to Sepolia
                </button>
              ) : (
                <button className={styles.revealBtn} onClick={onReveal} disabled={state === "revealing"}>
                  {eyeIcon}{state === "revealing" ? "Decrypting…" : "Reveal your payoff"}
                </button>
              )}
              {error && <div className={styles.errline}>{error}</div>}
            </>
          )}
          <div className={styles.sub2}>
            <div><div className={styles.k}>Principal</div><div className={`${styles.v} ${styles.set}`}>{fmt(floor)} floor</div></div>
            <div><div className={styles.k}>Cap</div><div className={styles.v}>band → {fmt(ceil)}</div></div>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardH}><span className={styles.t}>Terms</span><span className={styles.encnote}>{sealIcon}encrypted on-chain</span></div>
          <div className={styles.terms}>
            <div className={styles.trow}><span className={styles.k}>Strike</span><span className={styles.seal}>{sealIcon}▓▓▓▓▓</span></div>
            <div className={styles.trow}><span className={styles.k}>Leverage</span><span className={styles.seal}>{sealIcon}▓▓▓</span></div>
            <div className={styles.trow}><span className={styles.k}>Reference asset</span><span className={styles.v}>XAU / USD (Chainlink)</span></div>
            <div className={styles.trow}><span className={styles.k}>Status</span><span className={styles.v}>{props.claimed ? "Claimed" : props.settled ? "Settled" : "Open"}</span></div>
          </div>
          <div className={styles.verify}>Settled on-chain · <a href={`https://sepolia.etherscan.io/address/${noteContract}`} target="_blank" rel="noreferrer">{shortAddr(noteContract)} ↗</a></div>
        </div>
      </div>
    </div>
  );
}
