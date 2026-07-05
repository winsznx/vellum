"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import "@rainbow-me/rainbowkit/styles.css";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();

// Vellum-tuned RainbowKit dark theme: flow-indigo accent, ink surfaces, matched radii.
const vellumTheme = darkTheme({
  accentColor: "#5562E0", // --flow-500
  accentColorForeground: "#fff",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={vellumTheme} initialChain={11155111}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
