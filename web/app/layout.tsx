import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./Providers";

export const metadata: Metadata = {
  title: "Vellum — Financial agreements that compute while encrypted",
  description: "Composable confidential finance on Zama FHEVM. Terms stay sealed on-chain — they compute and settle without ever being revealed, and only you can unlock your own outcome.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
