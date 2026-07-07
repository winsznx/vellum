"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { formatUnits, parseUnits } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useConnectorClient, usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { CheckCircle2, Coins, Droplets, Eye, Loader2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MachineValue, SealGlyph } from "@/components/vellum/seal";
import { TxProof } from "@/components/vellum/proof";
import { useSepoliaGuard, useTxAction, type TxState } from "@/components/vellum/tx";
import { ERC20_ABI, WRAPPER_ABI, ZERO_HANDLE } from "@/lib/vellum";
import { cn } from "@/lib/utils";

const DEMO_AMOUNT = "10";

export type FeaturedPair = {
  token: `0x${string}`;
  conf: `0x${string}`;
  symbol: string;
  confSymbol: string;
  decimals: number;
};

type RevealState = { phase: "idle" | "revealing" | "revealed" | "error"; value?: string; error?: string };

function TxStatus({ s }: { s: TxState }) {
  if (s.phase === "signing") return <span className="text-[12px] text-flow-400">Awaiting wallet signature…</span>;
  if (s.phase === "pending")
    return (
      <span className="inline-flex items-center gap-2 text-[12px] text-flow-400">
        <Loader2 className="size-3.5 animate-spin" /> Confirming on Sepolia… {s.hash ? <TxProof hash={s.hash} /> : null}
      </span>
    );
  if (s.phase === "confirmed")
    return (
      <span className="inline-flex items-center gap-2 text-[12px] text-settle-400">
        <CheckCircle2 className="size-3.5" /> Confirmed {s.hash ? <TxProof hash={s.hash} /> : null}
      </span>
    );
  if (s.phase === "error") return <span className="text-[12px] text-danger-400">{s.error}</span>;
  return null;
}

function Step({ n, icon, title, desc, done, control, status }: { n: number; icon: ReactNode; title: string; desc: string; done: boolean; control: ReactNode; status: ReactNode }) {
  return (
    <div className="flex gap-3.5 border-b border-border-hairline px-5 py-4 last:border-b-0">
      <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border text-[12px]", done ? "border-settle-500/40 bg-settle-500/10 text-settle-400" : "border-flow-500/30 bg-flow-500/10 text-flow-400")}>
        {done ? <CheckCircle2 className="size-4" /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-text-primary">
              <MachineValue className="mr-1.5 text-text-tertiary">{String(n).padStart(2, "0")}</MachineValue>
              {title}
            </div>
            <div className="mt-0.5 text-[12.5px] leading-5 text-text-secondary">{desc}</div>
          </div>
          <div className="shrink-0">{control}</div>
        </div>
        {status ? <div className="mt-2">{status}</div> : null}
      </div>
    </div>
  );
}

export function RegistryLoop({ pair }: { pair: FeaturedPair }) {
  const { address, isConnected } = useAccount();
  const { wrongChain } = useSepoliaGuard();
  const { data: connectorClient } = useConnectorClient();
  const publicClient = usePublicClient({ chainId: sepolia.id });

  const faucet = useTxAction();
  const approve = useTxAction();
  const wrap = useTxAction();
  const [reveal, setReveal] = useState<RevealState>({ phase: "idle" });
  const [unw, setUnw] = useState<{ phase: "idle" | "running" | "done" | "error"; label?: string; requestTx?: string; finalizeTx?: string; error?: string }>({ phase: "idle" });

  const amount = parseUnits(DEMO_AMOUNT, pair.decimals);
  const ready = isConnected && !wrongChain;

  const onFaucet = () => faucet.run({ address: pair.token, abi: ERC20_ABI, functionName: "mint", args: [address, amount] });
  const onApprove = () => approve.run({ address: pair.token, abi: ERC20_ABI, functionName: "approve", args: [pair.conf, amount] });
  const onWrap = () => wrap.run({ address: pair.conf, abi: WRAPPER_ABI, functionName: "wrap", args: [address, amount] });

  const onReveal = async () => {
    setReveal({ phase: "revealing" });
    try {
      if (!publicClient || !address) throw new Error("Connect the wallet on Sepolia first.");
      const handle = (await publicClient.readContract({ address: pair.conf, abi: WRAPPER_ABI, functionName: "confidentialBalanceOf", args: [address] })) as string;
      if (!handle || handle === ZERO_HANDLE) {
        setReveal({ phase: "error", error: "No confidential balance yet — wrap first, then reveal." });
        return;
      }
      const transport = connectorClient?.transport as { request?: unknown } | undefined;
      if (!transport?.request) throw new Error("Wallet transport unavailable. Reconnect the wallet and retry.");
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(transport as never);
      const { revealHandle } = await import("@/lib/fhe");
      const { cleartext } = await revealHandle({ handle, contractAddress: pair.conf, provider });
      setReveal({ phase: "revealed", value: `${formatUnits(cleartext, pair.decimals)} ${pair.confSymbol}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setReveal({ phase: "error", error: /not authorized|acl|not allowed|user decrypt/i.test(msg) ? "This wallet is not authorized to decrypt that balance." : msg });
    }
  };

  const onUnwrap = async () => {
    setUnw({ phase: "running", label: "Preparing…" });
    try {
      if (!address) throw new Error("Connect the wallet on Sepolia first.");
      const transport = connectorClient?.transport as { request?: unknown } | undefined;
      if (!transport?.request) throw new Error("Wallet transport unavailable. Reconnect the wallet and retry.");
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(transport as never);
      const { unwrapConfidential } = await import("@/lib/fhe");
      const labels: Record<string, string> = {
        encrypting: "Encrypting amount…",
        requesting: "Requesting unwrap…",
        resolving: "Resolving request id…",
        decrypting: "Public-decrypting (KMS)…",
        finalizing: "Finalizing…",
        done: "Done",
      };
      const res = await unwrapConfidential({
        wrapper: pair.conf,
        amount,
        provider,
        onProgress: (p) => setUnw((s) => ({ ...s, phase: "running", label: labels[p.phase] ?? p.phase, requestTx: p.phase === "requesting" && p.tx ? p.tx : s.requestTx })),
      });
      setUnw({ phase: "done", requestTx: res.requestTx, finalizeTx: res.finalizeTx });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUnw({ phase: "error", error: /not authorized|acl|not allowed/i.test(msg) ? "This wallet is not authorized to unwrap that balance." : msg });
    }
  };

  const btn = (label: string, onClick: () => void, s: TxState, variant: "default" | "seal" = "default") => (
    <Button size="sm" variant={variant} disabled={!ready || s.phase === "signing" || s.phase === "pending"} onClick={onClick}>
      {s.phase === "signing" || s.phase === "pending" ? <Loader2 className="size-4 animate-spin" /> : null}
      {label}
    </Button>
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-hairline bg-ink-900 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[13px] font-semibold text-text-primary">Wrap loop</span>
          <span className="text-[12px] text-text-tertiary">
            <MachineValue>{pair.symbol}</MachineValue> → <MachineValue className="text-cipher-300">{pair.confSymbol}</MachineValue> · <MachineValue>{DEMO_AMOUNT}</MachineValue> per run
          </span>
        </div>
        {!isConnected ? <ConnectButton label="Connect to start" /> : wrongChain ? <span className="text-[12px] text-danger-400">Switch wallet to Sepolia</span> : null}
      </div>

      <Step
        n={1}
        icon={<Droplets className="size-4" />}
        title={`Claim ${pair.symbol}`}
        desc={`Mint ${DEMO_AMOUNT} ${pair.symbol} to your wallet from the Sepolia test-asset faucet.`}
        done={faucet.state.phase === "confirmed"}
        control={btn("Claim faucet", onFaucet, faucet.state)}
        status={<TxStatus s={faucet.state} />}
      />
      <Step
        n={2}
        icon={<ShieldCheck className="size-4" />}
        title="Approve wrapper"
        desc={`Authorize the ${pair.confSymbol} wrapper to pull ${DEMO_AMOUNT} ${pair.symbol}.`}
        done={approve.state.phase === "confirmed"}
        control={btn("Approve", onApprove, approve.state)}
        status={<TxStatus s={approve.state} />}
      />
      <Step
        n={3}
        icon={<Coins className="size-4" />}
        title="Wrap into confidential twin"
        desc={`Wrap ${pair.symbol} into ${pair.confSymbol}. The balance moves to a sealed ERC-7984 register.`}
        done={wrap.state.phase === "confirmed"}
        control={btn("Wrap", onWrap, wrap.state)}
        status={<TxStatus s={wrap.state} />}
      />
      <Step
        n={4}
        icon={<LockKeyhole className="size-4" />}
        title="Reveal confidential balance"
        desc="Decrypt your sealed balance locally with an EIP-712 signature. Holder-decrypt only."
        done={reveal.phase === "revealed"}
        control={
          reveal.phase === "revealed" ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-reveal-400">
              <Eye className="size-3.5" /> revealed
            </span>
          ) : (
            <Button size="sm" variant="seal" disabled={!ready || reveal.phase === "revealing"} onClick={onReveal}>
              {reveal.phase === "revealing" ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
              {reveal.phase === "revealing" ? "Decrypting…" : "Reveal balance"}
            </Button>
          )
        }
        status={
          reveal.phase === "revealed" ? (
            <MachineValue className="revealing text-[14px] font-medium text-reveal-400">{reveal.value}</MachineValue>
          ) : reveal.phase === "error" ? (
            <span className="text-[12px] text-danger-400">{reveal.error}</span>
          ) : (
            <SealGlyph>▓▓▓▓ {pair.confSymbol}</SealGlyph>
          )
        }
      />
      <Step
        n={5}
        icon={<Coins className="size-4" />}
        title={`Unwrap to ${pair.symbol}`}
        desc="Return the confidential balance to public USDC — a 2-step confidential→public unwrap finalized with a KMS proof."
        done={unw.phase === "done"}
        control={
          unw.phase === "done" ? (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-settle-400">
              <CheckCircle2 className="size-3.5" /> unwrapped
            </span>
          ) : (
            <Button size="sm" variant="secondary" disabled={!ready || unw.phase === "running"} onClick={onUnwrap}>
              {unw.phase === "running" ? <Loader2 className="size-4 animate-spin" /> : null}
              {unw.phase === "running" ? "Unwrapping…" : "Unwrap"}
            </Button>
          )
        }
        status={
          unw.phase === "running" ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-[12px] text-flow-400">
              <Loader2 className="size-3.5 animate-spin" /> {unw.label} {unw.requestTx ? <TxProof label="request" hash={unw.requestTx} /> : null}
            </span>
          ) : unw.phase === "done" ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-[12px] text-settle-400">
              <CheckCircle2 className="size-3.5" /> Returned {DEMO_AMOUNT} {pair.symbol}
              {unw.requestTx ? <TxProof label="request" hash={unw.requestTx} /> : null}
              {unw.finalizeTx ? <TxProof label="finalize" hash={unw.finalizeTx} /> : null}
            </span>
          ) : unw.phase === "error" ? (
            <span className="text-[12px] text-danger-400">{unw.error}</span>
          ) : (
            <span className="text-[12px] text-text-tertiary">Available after wrapping.</span>
          )
        }
      />
    </Card>
  );
}
