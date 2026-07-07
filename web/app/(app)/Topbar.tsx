"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StateDot } from "@/components/vellum/seal";
import { MachineValue } from "@/components/vellum/seal";

export function Topbar({ crumb }: { crumb: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 flex h-[60px] w-full max-w-full shrink-0 items-center justify-between gap-3 overflow-hidden border-b border-border-hairline bg-surface-sunken px-7 max-sm:px-4">
      <div className="min-w-0 truncate text-[13.5px] text-text-tertiary">{crumb}</div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-flow-500/30 bg-flow-500/10 px-3 py-1.5 text-[12.5px] font-medium text-flow-400 max-sm:hidden">
          <StateDot className="bg-flow shadow-[0_0_8px_var(--flow-500)]" />Sepolia
        </span>
        <ConnectButton.Custom>
          {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
            const ready = mounted;
            const connected = ready && account && chain;
            if (!connected) {
              return (
                <Button onClick={openConnectModal} size="sm" className="max-sm:px-3">
                  <Wallet className="size-4" />
                  Connect
                </Button>
              );
            }
            if (chain.unsupported) {
              return (
                <Button onClick={openChainModal} size="sm" variant="danger">
                  Switch
                </Button>
              );
            }
            return (
              <Button onClick={openAccountModal} size="sm" variant="secondary" className="max-sm:px-3">
                <Wallet className="size-4" />
                <MachineValue>{account.displayName}</MachineValue>
              </Button>
            );
          }}
        </ConnectButton.Custom>
      </div>
    </div>
  );
}
