import { Topbar } from "../Topbar";
import { DocsView } from "./DocsView";
import { VELLUM_SEPOLIA, REGISTRY, FEEDS_SEPOLIA, SEPOLIA_CHAIN_ID } from "@/lib/vellum";

export default function DocsPage() {
  return (
    <>
      <Topbar crumb={<span className="font-semibold text-text-primary">Docs</span>} />
      <DocsView
        note={VELLUM_SEPOLIA.confidentialNoteV3}
        oracle={VELLUM_SEPOLIA.oracleAdapter}
        disperse={VELLUM_SEPOLIA.disperseSingleton}
        registry={REGISTRY[SEPOLIA_CHAIN_ID]}
        xau={FEEDS_SEPOLIA.xauUsd}
        eth={FEEDS_SEPOLIA.ethUsd}
        btc={FEEDS_SEPOLIA.btcUsd}
      />
    </>
  );
}
