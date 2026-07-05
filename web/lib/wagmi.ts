"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { http } from "wagmi";
import { SEPOLIA_RPC_URL } from "./vellum";

// WalletConnect projectId — set NEXT_PUBLIC_WC_PROJECT_ID in the environment. Without it, injected
// wallets (MetaMask/Rabby) still work; only the WalletConnect QR path is disabled.
const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "VELLUM_DEV_PLACEHOLDER";

export const wagmiConfig = getDefaultConfig({
  appName: "Vellum",
  projectId,
  chains: [sepolia],
  transports: { [sepolia.id]: http(SEPOLIA_RPC_URL) },
  ssr: true,
});
