import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { NETWORK_LABEL, etherscanAddr, etherscanTx, shortAddr } from "@/lib/vellum";
import { cn } from "@/lib/utils";

// Proof anchors — every important surface links to a real on-chain artifact so a judge
// never wonders whether the app is real. Pure/server-safe (no hooks).

function Chip({ href, className, children }: { href?: string; className?: string; children: ReactNode }) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md border border-border-hairline bg-surface-raised px-2.5 py-1 text-[11.5px] text-text-secondary";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cn(base, "hover:border-border-strong hover:text-text-primary", className)}>
        {children}
        <ArrowUpRight className="size-3 text-text-tertiary" />
      </a>
    );
  }
  return <span className={cn(base, className)}>{children}</span>;
}

export function AddressProof({ label, address }: { label: string; address: string }) {
  return (
    <Chip href={etherscanAddr(address)}>
      <span className="text-text-tertiary">{label}</span>
      <span className="font-mono [font-variant-numeric:tabular-nums]">{shortAddr(address)}</span>
    </Chip>
  );
}

export function TxProof({ label = "tx", hash }: { label?: string; hash: string }) {
  return (
    <Chip href={etherscanTx(hash)} className="text-settle-400 hover:text-settle-300">
      <span className="text-text-tertiary">{label}</span>
      <span className="font-mono [font-variant-numeric:tabular-nums]">{shortAddr(hash)}</span>
    </Chip>
  );
}

export function NetworkProof() {
  return (
    <Chip className="text-flow-400">
      <span className="size-1.5 rounded-full bg-flow shadow-[0_0_8px_var(--flow-500)]" />
      {NETWORK_LABEL}
    </Chip>
  );
}

export function TextProof({ label, value }: { label: string; value: string }) {
  return (
    <Chip>
      <span className="text-text-tertiary">{label}</span>
      <span className="font-mono [font-variant-numeric:tabular-nums]">{value}</span>
    </Chip>
  );
}

export function ProofBar({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
