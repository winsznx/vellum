"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Eye, LockKeyhole, ShieldCheck } from "lucide-react";
import { useAccount, useConnectorClient, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MachineValue, SealGlyph } from "@/components/vellum/seal";
import { cn } from "@/lib/utils";
import { ZERO_HANDLE, shortAddr } from "@/lib/vellum";

const X0 = 60;
const X1 = 540;
const Y_FLOOR = 260;
const Y_CEIL = 96;
const X_STRIKE = 300;
const X_CAP_KNEE = 470;

type Props = {
  principal6: string;
  cap6: string;
  refEndUsd: string;
  payoffHandle: string;
  claimed: boolean;
  settled: boolean;
  holder: string;
  noteContract: string;
};

export function PayoffSurface(props: Props) {
  const { payoffHandle, noteContract } = props;
  const principal = Number(props.principal6) / 1e6;
  const cap = Number(props.cap6) / 1e6;
  const floor = principal;
  const ceiling = principal + cap;

  const [state, setState] = useState<"sealed" | "revealing" | "revealed" | "error">("sealed");
  const [payoff, setPayoff] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { address, isConnected, chainId } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== sepolia.id;
  const holderMismatch = Boolean(isConnected && address && props.holder && address.toLowerCase() !== props.holder.toLowerCase());
  const unavailable = !payoffHandle || payoffHandle === ZERO_HANDLE;

  const payoffToY = (v: number) => {
    const frac = ceiling > floor ? (v - floor) / (ceiling - floor) : 0;
    const clamped = Math.max(0, Math.min(1, frac));
    return Y_FLOOR - clamped * (Y_FLOOR - Y_CEIL);
  };

  const onReveal = async () => {
    setState("revealing");
    setError(null);
    try {
      if (holderMismatch) {
        throw new Error("Connected wallet is not the note holder. Connect the holder wallet to reveal.");
      }
      const transport = connectorClient?.transport as { request?: unknown } | undefined;
      if (!transport?.request) {
        throw new Error("Wallet not connected. Connect the holder wallet on Sepolia to reveal your payoff.");
      }
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(transport as never);
      const { revealHandle } = await import("@/lib/fhe");
      const { cleartext } = await revealHandle({ handle: payoffHandle, contractAddress: noteContract, provider });
      setPayoff(Number(cleartext) / 1e6);
      setState("revealed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/not authorized|acl|user decrypt|not allowed/i.test(msg) ? "This wallet is not the note holder. The payoff stays sealed to you." : msg);
      setState("error");
    }
  };

  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const revealed = state === "revealed" && payoff !== null;
  const warmY = revealed ? payoffToY(payoff) : Y_CEIL;
  const warmX = revealed && payoff! >= ceiling - 1e-9 ? 500 : 430;

  return (
    <div className="mt-7 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader>
          <CardTitle>Payoff</CardTitle>
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-cipher-400">
            <LockKeyhole className="size-3 stroke-[1.7]" />
            computed on encrypted terms
          </span>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <svg className="block h-auto w-full" viewBox="0 0 580 360" role="img" aria-label="Capped call-spread payoff curve">
            <g stroke="rgba(255,255,255,.05)" strokeWidth="1">
              <line x1={X0} y1="60" x2={X1} y2="60" />
              <line x1={X0} y1="120" x2={X1} y2="120" />
              <line x1={X0} y1="180" x2={X1} y2="180" />
              <line x1={X0} y1="220" x2={X1} y2="220" />
            </g>
            <line x1={X0} y1="40" x2={X0} y2={Y_FLOOR + 60} stroke="rgba(255,255,255,.16)" />
            <line x1={X0} y1={Y_FLOOR + 60} x2={X1} y2={Y_FLOOR + 60} stroke="rgba(255,255,255,.16)" />

            <line x1={X0} y1={Y_FLOOR} x2={X1} y2={Y_FLOOR} stroke="var(--settle-500)" strokeWidth="1.5" strokeDasharray="5 5" opacity=".8" />
            <text x={X0 + 4} y={Y_FLOOR - 6} fill="var(--settle-400)" className="[font-family:var(--font-mono)] text-[11px]">
              Principal floor · {fmt(floor)}
            </text>
            <line x1={X0} y1={Y_CEIL} x2={X1} y2={Y_CEIL} stroke="var(--slate-500)" strokeWidth="1.5" strokeDasharray="5 5" opacity=".7" />
            <text x={X0 + 4} y={Y_CEIL - 6} fill="var(--slate-300)" className="[font-family:var(--font-mono)] text-[11px]">
              Ceiling · {fmt(ceiling)}
            </text>

            <line x1={X_STRIKE} y1={Y_FLOOR} x2={X_STRIKE} y2={Y_FLOOR + 60} stroke="var(--cipher-500)" strokeWidth="1" strokeDasharray="3 4" />
            <g transform={`translate(${X_STRIKE},${Y_FLOOR + 78})`}>
              <rect x="-34" y="-13" width="68" height="20" rx="5" fill="rgba(88,106,140,.16)" stroke="rgba(88,106,140,.3)" />
              <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" fill="var(--cipher-400)" fontFamily="var(--font-mono)" fontSize="11" letterSpacing="2">
                ▓▓▓
              </text>
            </g>
            <text x={X_STRIKE - 38} y={Y_FLOOR + 83} textAnchor="end" fill="var(--text-tertiary)" className="text-[11px]">
              strike
            </text>

            <path d={`M${X0} ${Y_FLOOR} L${X_STRIKE} ${Y_FLOOR} L${X_CAP_KNEE} ${Y_CEIL} L${X1} ${Y_CEIL}`} fill="none" stroke="var(--slate-400)" strokeWidth="2" />

            {!revealed && !unavailable && (
              <>
                <circle cx="500" cy={Y_CEIL} r="5.5" fill="var(--cipher-500)" stroke="var(--ink-950)" strokeWidth="1.5" />
                <g transform={`translate(420,${Y_CEIL - 30})`}>
                  <rect x="0" y="0" width="120" height="26" rx="6" fill="var(--ink-800)" stroke="rgba(88,106,140,.3)" />
                  <text x="10" y="17" fill="var(--cipher-400)" fontFamily="var(--font-mono)" fontSize="12" letterSpacing="2">
                    ▓▓▓ cUSDT
                  </text>
                </g>
              </>
            )}

            {revealed && (
              <g className="revealing">
                <circle cx={warmX} cy={warmY} r="13" fill="rgba(236,166,58,.18)" />
                <circle cx={warmX} cy={warmY} r="5.5" fill="var(--reveal-400)" stroke="var(--ink-950)" strokeWidth="1.5" />
                <g transform={`translate(${warmX - 150},${warmY - 14})`}>
                  <rect x="0" y="0" width="140" height="44" rx="8" fill="var(--ink-800)" stroke="rgba(236,166,58,.35)" />
                  <text x="12" y="18" fill="var(--reveal-300)" className="text-[11px]">
                    Your payoff
                  </text>
                  <text x="12" y="37" fill="var(--reveal-400)" fontFamily="var(--font-mono)" fontSize="16" fontWeight="500">
                    {fmt(payoff!)}
                    <tspan fontSize="11" fill="var(--reveal-300)">
                      {" "}cUSDT
                    </tspan>
                  </text>
                </g>
              </g>
            )}

            <text x={(X0 + X1) / 2} y={Y_FLOOR + 96} textAnchor="middle" fill="var(--text-tertiary)" className="text-[11px]">
              Gold (XAU {props.refEndUsd}) reference at maturity · public
            </text>
          </svg>
          <p className="mt-3 text-[11.5px] text-text-tertiary">Shape is public. Strike, leverage, and the holder payoff stay encrypted.</p>
        </CardContent>
      </Card>

      <div className="flex min-w-0 flex-col gap-5">
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-5">
            <div className="text-[12px] text-text-tertiary">Your payoff</div>
            {unavailable ? (
              <>
                <div className="mt-2">
                  <SealGlyph className="text-[18px]">▓▓▓▓▓▓</SealGlyph>
                </div>
                <div className="mt-3 text-[11.5px] text-cipher-400">Not yet claimed: the payoff handle is still sealed on-chain.</div>
              </>
            ) : revealed ? (
              <>
                <div className="revealing mt-2 font-mono text-[34px] font-medium leading-none text-reveal-400 [font-variant-numeric:tabular-nums] [text-shadow:0_0_26px_rgba(236,166,58,.30)]">
                  {fmt(payoff!)}
                  <span className="ml-1.5 text-[16px] text-reveal-300">cUSDT</span>
                </div>
                <div className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-reveal-400">
                  <Eye className="size-3.5 stroke-[1.7]" />
                  Decrypted for you · sealed for everyone else
                </div>
                {payoff! >= ceiling - 1e-9 && <div className="mt-2 text-[11.5px] text-reveal-300">Cap binds: payoff is at the ceiling ({fmt(ceiling)}).</div>}
              </>
            ) : (
              <>
                <div className="mt-2">
                  <SealGlyph className="text-[18px]">▓▓▓▓▓▓</SealGlyph>
                </div>
                <div className="mt-4">
                  {!isConnected ? (
                    <ConnectButton label="Connect wallet to reveal" />
                  ) : wrongChain ? (
                    <Button onClick={() => switchChain({ chainId: sepolia.id })} variant="default">
                      <Eye className="size-4" />
                      Switch to Sepolia
                    </Button>
                  ) : holderMismatch ? (
                    <div className="rounded-md border border-danger-500/25 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">
                      Connected wallet is not the holder. Connect <MachineValue>{shortAddr(props.holder)}</MachineValue> to reveal.
                    </div>
                  ) : (
                    <Button onClick={onReveal} disabled={state === "revealing"} variant="default">
                      <Eye className="size-4" />
                      {state === "revealing" ? "Decrypting..." : "Reveal your payoff"}
                    </Button>
                  )}
                </div>
                {error && <div className="mt-3 rounded-md border border-danger-500/25 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">{error}</div>}
              </>
            )}

            <div className="mt-5 grid grid-cols-2 gap-5 border-t border-border-hairline pt-4">
              <div>
                <div className="text-[12px] text-text-tertiary">Principal</div>
                <MachineValue className="mt-1 block text-[14px] text-settle-400">{fmt(floor)} floor</MachineValue>
              </div>
              <div>
                <div className="text-[12px] text-text-tertiary">Cap</div>
                <MachineValue className="mt-1 block text-[14px] text-text-primary">band to {fmt(ceiling)}</MachineValue>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardContent className="p-5">
            <div className="text-[12px] text-text-tertiary">Try it live</div>
            <div className="mt-3 grid gap-2 text-[12.5px] leading-5 text-text-secondary">
              <div className="flex items-center justify-between gap-3 rounded-md border border-border-hairline bg-ink-900 px-3 py-2">
                <span>Network</span>
                <MachineValue className={wrongChain ? "text-danger-400" : "text-flow-400"}>{wrongChain ? "switch to Sepolia" : "Sepolia"}</MachineValue>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border-hairline bg-ink-900 px-3 py-2">
                <span>Holder wallet</span>
                <MachineValue className={holderMismatch ? "text-danger-400" : "text-text-primary"}>{shortAddr(props.holder)}</MachineValue>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border-hairline bg-ink-900 px-3 py-2">
                <span>Payoff</span>
                {revealed ? <MachineValue className="text-reveal-400">revealed</MachineValue> : <SealGlyph>▓▓▓▓</SealGlyph>}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader>
            <CardTitle>Terms</CardTitle>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-cipher-400">
              <LockKeyhole className="size-3 stroke-[1.7]" />
              encrypted on-chain
            </span>
          </CardHeader>
          <CardContent className="p-0">
            {[
              ["Strike", <SealGlyph key="strike">▓▓▓▓▓</SealGlyph>],
              ["Leverage", <SealGlyph key="lev">▓▓▓</SealGlyph>],
              ["Reference asset", <MachineValue key="ref">XAU/USD</MachineValue>],
              ["Status", <MachineValue key="status">{props.claimed ? "Claimed" : props.settled ? "Settled" : "Open"}</MachineValue>],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex items-center justify-between gap-4 border-b border-border-hairline px-5 py-3 last:border-b-0">
                <span className="text-[13px] text-text-secondary">{k}</span>
                <span className={cn("text-[13px] text-text-primary", k === "Status" && props.claimed && "text-settle-400")}>{v}</span>
              </div>
            ))}
          </CardContent>
          <div className="border-t border-border-hairline px-5 py-3 text-[12px] text-text-tertiary">
            Only the authorized holder can decrypt the sealed terms and payoff.
          </div>
          <div className="flex items-center gap-2 px-5 py-3 text-[12px] text-text-tertiary">
            <ShieldCheck className="size-3.5 text-settle-400" />
            Settled on-chain ·{" "}
            <a className="font-mono text-flow-400 hover:text-flow-300" href={`https://sepolia.etherscan.io/address/${noteContract}`} target="_blank" rel="noreferrer">
              {shortAddr(noteContract)} ↗
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
