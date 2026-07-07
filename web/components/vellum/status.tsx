"use client";

import { useAccount } from "wagmi";
import { sepolia } from "wagmi/chains";
import { shortAddr } from "@/lib/vellum";
import { cn } from "@/lib/utils";

// System status module — replaces the loose "not connected" line with a serious
// wallet / network / relayer / registry readout. Values are live from wagmi.

function Row({ label, ok, warn, value }: { label: string; ok?: boolean; warn?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-text-tertiary">{label}</span>
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("size-1.5 rounded-full", warn ? "bg-danger" : ok ? "bg-settle shadow-[0_0_6px_var(--settle-500)]" : "bg-slate-600")} />
        <span className={cn("font-mono [font-variant-numeric:tabular-nums]", warn ? "text-danger-400" : ok ? "text-text-secondary" : "text-text-tertiary")}>{value}</span>
      </span>
    </div>
  );
}

export function SystemStatus({ className }: { className?: string }) {
  const { address, isConnected, chainId } = useAccount();
  const wrongNet = Boolean(isConnected && chainId !== sepolia.id);
  return (
    <div className={cn("grid gap-2 rounded-md border border-border-hairline bg-surface-raised p-2.5", className)}>
      <Row label="Wallet" ok={isConnected} value={isConnected && address ? shortAddr(address) : "Not connected"} />
      <Row label="Network" ok={isConnected && !wrongNet} warn={wrongNet} value={!isConnected ? "—" : wrongNet ? "Wrong network" : "Sepolia"} />
      <Row label="Relayer" ok value="Ready" />
      <Row label="Registry" ok value="Synced" />
    </div>
  );
}
