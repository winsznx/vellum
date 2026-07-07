"use client";

import { useCallback, useState } from "react";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";
import { sepolia } from "wagmi/chains";

// Real transaction primitive — one place that owns wallet/network guards and the
// signing → pending → confirmed → error lifecycle for every write flow in the app.

export type TxPhase = "idle" | "signing" | "pending" | "confirmed" | "error";
export type TxState = { phase: TxPhase; hash?: `0x${string}`; error?: string };
export type WriteCfg = { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] };

export function friendlyTxError(msg: string): string {
  if (/user rejected|user denied|rejected the request|action_rejected/i.test(msg)) return "Signature rejected in wallet.";
  if (/insufficient funds/i.test(msg)) return "Not enough Sepolia ETH for gas.";
  if (/chain mismatch|wrong network|switch/i.test(msg)) return "Switch your wallet to Sepolia and retry.";
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}

export function useSepoliaGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const wrongChain = Boolean(isConnected && chainId !== sepolia.id);
  const ensure = useCallback(async () => {
    if (!isConnected) throw new Error("Connect a wallet on Sepolia to continue.");
    if (chainId !== sepolia.id) await switchChainAsync({ chainId: sepolia.id });
  }, [isConnected, chainId, switchChainAsync]);
  return { isConnected, wrongChain, ensure };
}

export function useTxAction() {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { ensure } = useSepoliaGuard();
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const run = useCallback(
    async (cfg: WriteCfg): Promise<`0x${string}`> => {
      setState({ phase: "signing" });
      try {
        await ensure();
        // single library boundary: our structural WriteCfg → wagmi's generic write config
        const hash = await writeContractAsync(cfg as unknown as Parameters<typeof writeContractAsync>[0]);
        setState({ phase: "pending", hash });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash });
        setState({ phase: "confirmed", hash });
        return hash;
      } catch (e) {
        setState({ phase: "error", error: friendlyTxError(e instanceof Error ? e.message : String(e)) });
        throw e;
      }
    },
    [writeContractAsync, publicClient, ensure],
  );

  const reset = useCallback(() => setState({ phase: "idle" }), []);
  return { state, run, reset };
}
