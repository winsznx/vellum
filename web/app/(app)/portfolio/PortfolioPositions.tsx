"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Coins, Eye, LockKeyhole } from "lucide-react";
import { formatUnits } from "viem";
import { useAccount, useConnectorClient, usePublicClient, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MachineValue, SealGlyph } from "@/components/vellum/seal";
import { ERC7984_ABI, ZERO_HANDLE, shortAddr } from "@/lib/vellum";

export type PortfolioToken = {
  symbol: string;
  address: string;
  decimals: number;
};

type RevealState = {
  status: "sealed" | "revealing" | "revealed" | "error";
  value?: string;
  error?: string;
};

export function PortfolioPositions({ tokens }: { tokens: PortfolioToken[] }) {
  const { address, isConnected, chainId } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const walletPublicClient = usePublicClient({ chainId: sepolia.id });
  const { switchChain } = useSwitchChain();
  const [states, setStates] = useState<Record<string, RevealState>>({});
  const wrongChain = isConnected && chainId !== sepolia.id;

  const setTokenState = (token: string, next: RevealState) => setStates((cur) => ({ ...cur, [token]: next }));

  const revealBalance = async (token: PortfolioToken) => {
    setTokenState(token.address, { status: "revealing" });
    try {
      if (!address) throw new Error("Connect the wallet that owns this confidential balance.");
      if (!walletPublicClient) throw new Error("Sepolia client is unavailable.");
      const handle = (await walletPublicClient.readContract({
        address: token.address as `0x${string}`,
        abi: ERC7984_ABI,
        functionName: "confidentialBalanceOf",
        args: [address],
      })) as string;

      if (!handle || handle === ZERO_HANDLE) {
        setTokenState(token.address, { status: "sealed", error: "No encrypted balance handle is available for this position." });
        return;
      }

      const transport = connectorClient?.transport as { request?: unknown } | undefined;
      if (!transport?.request) throw new Error("Wallet transport unavailable. Reconnect the holder wallet and try again.");
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(transport as never);
      const { revealHandle } = await import("@/lib/fhe");
      const { cleartext } = await revealHandle({ handle, contractAddress: token.address, provider });
      setTokenState(token.address, {
        status: "revealed",
        value: `${formatUnits(cleartext, token.decimals)} ${token.symbol}`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTokenState(token.address, {
        status: "error",
        error: /not authorized|acl|user decrypt|not allowed/i.test(msg) ? "This wallet is not authorized to decrypt that balance." : msg,
      });
    }
  };

  if (!tokens.length) {
    return (
      <Card>
        <div className="p-6">
          <div className="text-[14px] font-semibold text-text-primary">Registry unavailable</div>
          <p className="mt-2 text-[13px] text-text-secondary">Could not read the live confidential-token list. No placeholder balances are shown.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-hairline bg-ink-900 px-5 py-3">
        <span className="text-[13px] font-semibold text-text-primary">Confidential assets</span>
        <MachineValue className="text-[12px] text-text-tertiary">{tokens.length} live registry positions</MachineValue>
      </div>
      <div className="grid grid-cols-[1.25fr_.8fr_.8fr_180px] border-b border-border-hairline px-5 py-2 text-[11px] uppercase text-text-tertiary max-lg:hidden">
        <span>Asset</span>
        <span>Balance</span>
        <span>Contract</span>
        <span className="text-right">Action</span>
      </div>
      {tokens.map((token) => {
        const state = states[token.address] ?? { status: "sealed" as const };
        const revealed = state.status === "revealed";

        return (
          <div key={token.address} className="grid grid-cols-[1.25fr_.8fr_.8fr_180px] items-center gap-4 border-b border-border-hairline px-5 py-4 last:border-b-0 max-lg:grid-cols-1">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-cipher-500/30 bg-cipher-500/10 text-cipher-300">
                <Coins className="size-4" />
              </span>
              <span className="min-w-0">
                <MachineValue className="block text-[14px] font-semibold text-text-primary">{token.symbol}</MachineValue>
                <span className="block text-[12px] text-text-tertiary">ERC-7984 confidential token</span>
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 lg:block">
              <span className="text-[11px] uppercase text-text-tertiary lg:hidden">Balance</span>
              {revealed ? (
                <MachineValue className="revealing text-[14px] font-medium text-reveal-400">{state.value}</MachineValue>
              ) : (
                <SealGlyph>{state.status === "revealing" ? "▓▓▓..." : "▓▓▓▓"}</SealGlyph>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 lg:block">
              <span className="text-[11px] uppercase text-text-tertiary lg:hidden">Contract</span>
              <MachineValue className="text-[12px] text-text-tertiary">{shortAddr(token.address)}</MachineValue>
            </div>

            <div className="flex justify-end max-lg:justify-start">
              <div>
                {!isConnected ? (
                  <ConnectButton label="Connect to decrypt" />
                ) : wrongChain ? (
                  <Button variant="secondary" size="sm" onClick={() => switchChain({ chainId: sepolia.id })}>
                    Switch to Sepolia
                  </Button>
                ) : revealed ? (
                  <div className="inline-flex items-center gap-1.5 text-[11.5px] text-reveal-400">
                    <Eye className="size-3.5 stroke-[1.7]" />
                    revealed to this wallet
                  </div>
                ) : (
                  <Button variant="seal" size="sm" onClick={() => revealBalance(token)} disabled={state.status === "revealing"}>
                    <LockKeyhole className="size-4" />
                    {state.status === "revealing" ? "Decrypting..." : "Decrypt position"}
                  </Button>
                )}
              </div>
            </div>

            {state.error && <div className="col-span-full rounded-md border border-danger-500/25 bg-danger-500/10 px-3 py-2 text-[12px] text-danger-400">{state.error}</div>}
          </div>
        );
      })}
    </Card>
  );
}
