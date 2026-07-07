"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useConnectorClient, usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Eye, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MachineValue, SealGlyph } from "@/components/vellum/seal";
import { useSepoliaGuard } from "@/components/vellum/tx";
import { FAUCET7984_ABI, VELLUM_SEPOLIA, ZERO_HANDLE } from "@/lib/vellum";

// Recipient reveal receipt — a real recipient of a confidential disperse decrypts only their
// own received allocation (cUSDM ERC-7984 balance) with an EIP-712 signature. Not a claim tx.
type State = { phase: "idle" | "revealing" | "revealed" | "error"; value?: string; error?: string };

export function DistributionReceipt() {
  const { address, isConnected } = useAccount();
  const { wrongChain } = useSepoliaGuard();
  const { data: connectorClient } = useConnectorClient();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const [state, setState] = useState<State>({ phase: "idle" });

  const token = VELLUM_SEPOLIA.cUSDM as `0x${string}`;

  const onReveal = async () => {
    setState({ phase: "revealing" });
    try {
      if (!publicClient || !address) throw new Error("Connect the recipient wallet on Sepolia first.");
      const handle = (await publicClient.readContract({ address: token, abi: FAUCET7984_ABI, functionName: "confidentialBalanceOf", args: [address] })) as string;
      if (!handle || handle === ZERO_HANDLE) {
        setState({ phase: "error", error: "This wallet has no cUSDM allocation to reveal." });
        return;
      }
      const transport = connectorClient?.transport as { request?: unknown } | undefined;
      if (!transport?.request) throw new Error("Wallet transport unavailable. Reconnect and retry.");
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(transport as never);
      const { revealHandle } = await import("@/lib/fhe");
      const { cleartext } = await revealHandle({ handle, contractAddress: token, provider });
      setState({ phase: "revealed", value: `${formatUnits(cleartext, 6)} cUSDM` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ phase: "error", error: /not authorized|acl|not allowed|user decrypt/i.test(msg) ? "This wallet is not authorized to decrypt that allocation." : msg });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] text-text-tertiary">Your received allocation</span>
        {state.phase === "revealed" ? (
          <MachineValue className="revealing text-[15px] font-medium text-reveal-400">{state.value}</MachineValue>
        ) : (
          <SealGlyph>{state.phase === "revealing" ? "▓▓▓…" : "▓▓▓▓▓"}</SealGlyph>
        )}
      </div>
      <div className="mt-4">
        {!isConnected ? (
          <ConnectButton label="Connect to reveal allocation" />
        ) : wrongChain ? (
          <span className="text-[12px] text-danger-400">Switch your wallet to Sepolia to reveal.</span>
        ) : state.phase === "revealed" ? (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] text-reveal-400">
            <Eye className="size-3.5 stroke-[1.7]" /> revealed to this wallet only
          </span>
        ) : (
          <Button variant="seal" size="sm" onClick={onReveal} disabled={state.phase === "revealing"}>
            {state.phase === "revealing" ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
            {state.phase === "revealing" ? "Decrypting…" : "Reveal allocation"}
          </Button>
        )}
      </div>
      {state.phase === "error" ? <p className="mt-3 text-[12px] text-danger-400">{state.error}</p> : null}
    </div>
  );
}
