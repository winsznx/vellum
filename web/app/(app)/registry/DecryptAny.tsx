"use client";

import { useState } from "react";
import { formatUnits } from "viem";
import { useAccount, useConnectorClient, usePublicClient } from "wagmi";
import { sepolia } from "wagmi/chains";
import { Eye, Loader2, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MachineValue, SealGlyph } from "@/components/vellum/seal";
import { useSepoliaGuard } from "@/components/vellum/tx";
import { ERC7984_ABI, ZERO_HANDLE } from "@/lib/vellum";

type State = { phase: "idle" | "loading" | "done" | "error"; symbol?: string; value?: string; error?: string };

export function DecryptAny() {
  const { address, isConnected } = useAccount();
  const { wrongChain } = useSepoliaGuard();
  const { data: connectorClient } = useConnectorClient();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const [addr, setAddr] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });

  const isAddr = /^0x[0-9a-fA-F]{40}$/.test(addr.trim());

  const run = async () => {
    setState({ phase: "loading" });
    try {
      if (!isConnected || wrongChain) throw new Error("Connect a wallet on Sepolia first.");
      if (!publicClient || !address) throw new Error("Sepolia client unavailable.");
      const token = addr.trim() as `0x${string}`;
      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({ address: token, abi: ERC7984_ABI, functionName: "symbol" }).catch(() => "cToken"),
        publicClient.readContract({ address: token, abi: ERC7984_ABI, functionName: "decimals" }).catch(() => 6),
      ]);
      const handle = (await publicClient.readContract({ address: token, abi: ERC7984_ABI, functionName: "confidentialBalanceOf", args: [address] })) as string;
      if (!handle || handle === ZERO_HANDLE) {
        setState({ phase: "error", symbol: String(symbol), error: "No confidential balance handle for this wallet on that token." });
        return;
      }
      const transport = connectorClient?.transport as { request?: unknown } | undefined;
      if (!transport?.request) throw new Error("Wallet transport unavailable. Reconnect and retry.");
      const { BrowserProvider } = await import("ethers");
      const provider = new BrowserProvider(transport as never);
      const { revealHandle } = await import("@/lib/fhe");
      const { cleartext } = await revealHandle({ handle, contractAddress: token, provider });
      setState({ phase: "done", symbol: String(symbol), value: `${formatUnits(cleartext, Number(decimals))} ${String(symbol)}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ phase: "error", error: /not authorized|acl|not allowed|user decrypt/i.test(msg) ? "This wallet is not authorized to decrypt that token's balance." : msg });
    }
  };

  return (
    <Card className="p-5">
      <h3 className="text-[14px] font-semibold text-text-primary">Decrypt any confidential token</h3>
      <p className="mt-1 max-w-[64ch] text-[12.5px] leading-5 text-text-secondary">
        Paste any ERC-7984 token address. Vellum reads your sealed balance handle and reveals it locally with an EIP-712 signature — the balance decrypts only for the wallet that holds it.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="0x… ERC-7984 token address"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-md border border-border-hairline bg-ink-900 px-3 py-2 font-mono text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-flow-500/50 focus:outline-none"
        />
        <Button size="md" variant="seal" disabled={!isAddr || state.phase === "loading"} onClick={run}>
          {state.phase === "loading" ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
          {state.phase === "loading" ? "Decrypting…" : "Reveal balance"}
        </Button>
      </div>
      {addr.trim() && !isAddr ? <p className="mt-2 text-[12px] text-danger-400">Enter a valid 20-byte address.</p> : null}
      {state.phase === "done" ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-reveal-500/25 bg-reveal-500/10 px-4 py-3">
          <Eye className="size-4 text-reveal-400" />
          <MachineValue className="revealing text-[15px] font-medium text-reveal-400">{state.value}</MachineValue>
        </div>
      ) : state.phase === "error" ? (
        <p className="mt-3 text-[12.5px] text-danger-400">{state.error}</p>
      ) : (
        <div className="mt-4">
          <SealGlyph>▓▓▓▓▓ sealed</SealGlyph>
        </div>
      )}
    </Card>
  );
}
