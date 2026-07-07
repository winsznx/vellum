import { ArrowRight, Coins, Droplets, LockKeyhole, ShieldCheck } from "lucide-react";
import { Topbar } from "../Topbar";
import { RegistryLoop, type FeaturedPair } from "./RegistryLoop";
import { DecryptAny } from "./DecryptAny";
import { Badge } from "@/components/ui/badge";
import { Card, CardFooter } from "@/components/ui/card";
import { MachineValue, SealGlyph, StateDot } from "@/components/vellum/seal";
import { AddressProof, NetworkProof, ProofBar, TextProof } from "@/components/vellum/proof";
import { publicClient } from "@/lib/viem";
import { REGISTRY, REGISTRY_ABI, ERC20_ABI, ERC7984_ABI, SEPOLIA_CHAIN_ID, VELLUM_SEPOLIA, shortAddr } from "@/lib/vellum";

export const revalidate = 60;

type Pair = { token: string; conf: string; isValid: boolean; symbol: string; confSymbol: string; decimals: number };

async function readPairs(): Promise<Pair[]> {
  const client = publicClient();
  const raw = (await client.readContract({
    address: REGISTRY[SEPOLIA_CHAIN_ID] as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getTokenConfidentialTokenPairs",
  })) as readonly { tokenAddress: string; confidentialTokenAddress: string; isValid: boolean }[];

  return Promise.all(
    raw
      .filter((p) => p.isValid)
      .map(async (p) => {
        const [symbol, decimals, confSymbol] = await Promise.all([
          client.readContract({ address: p.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: "symbol" }).catch(() => "?"),
          client.readContract({ address: p.tokenAddress as `0x${string}`, abi: ERC20_ABI, functionName: "decimals" }).catch(() => 18),
          client.readContract({ address: p.confidentialTokenAddress as `0x${string}`, abi: ERC7984_ABI, functionName: "symbol" }).catch(() => "?"),
        ]);
        return {
          token: p.tokenAddress,
          conf: p.confidentialTokenAddress,
          isValid: p.isValid,
          symbol: String(symbol),
          confSymbol: String(confSymbol),
          decimals: Number(decimals),
        };
      }),
  );
}

function pickFeatured(pairs: Pair[]): FeaturedPair {
  const usdc = VELLUM_SEPOLIA.usdc.toLowerCase();
  const match = pairs.find((p) => p.token.toLowerCase() === usdc);
  if (match) {
    return { token: match.token as `0x${string}`, conf: match.conf as `0x${string}`, symbol: match.symbol, confSymbol: match.confSymbol, decimals: match.decimals };
  }
  return { token: VELLUM_SEPOLIA.usdc as `0x${string}`, conf: VELLUM_SEPOLIA.wrapperCUSDT as `0x${string}`, symbol: "USDC", confSymbol: "cUSDT", decimals: 6 };
}

export default async function RegistryPage() {
  let pairs: Pair[] = [];
  let error: string | null = null;
  try {
    pairs = await readPairs();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const featured = pickFeatured(pairs);

  return (
    <>
      <Topbar crumb={<span className="font-semibold text-text-primary">Registry</span>} />
      <main className="w-full max-w-[1280px] overflow-x-hidden px-9 py-8 max-sm:px-4">
        <Card className="overflow-hidden">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px] max-sm:p-5">
            <div className="min-w-0">
              <Badge variant="settle">
                <StateDot className="bg-settle shadow-[0_0_8px_var(--settle-500)]" />
                Confidential Wrapper Registry
              </Badge>
              <h1 className="mt-4 max-w-[760px] text-[30px] font-semibold leading-tight text-text-primary max-sm:text-[24px]">
                Browse, wrap, and reveal confidential assets.
              </h1>
              <p className="mt-3 max-w-[74ch] text-[14px] leading-6 text-text-secondary">
                Official Zama wrapper pairs are read live from Sepolia. Pick a pair, claim test funds, approve the wrapper, wrap into ERC-7984, then reveal the sealed balance locally.
              </p>
              <ProofBar className="mt-5">
                <span className="text-[12px] text-text-tertiary">Source: Zama Wrappers Registry</span>
                <AddressProof label="registry" address={REGISTRY[SEPOLIA_CHAIN_ID]} />
                <TextProof label="pairs" value={String(pairs.length)} />
                <NetworkProof />
              </ProofBar>
            </div>

            <div className="grid content-between gap-4 rounded-md border border-border-hairline bg-ink-900 p-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-text-tertiary">Selected loop</span>
                  <Badge variant="flow">live tx</Badge>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-md border border-settle-500/30 bg-settle-500/10 text-settle-400">
                    <Droplets className="size-4" />
                  </span>
                  <ArrowRight className="size-4 text-text-tertiary" />
                  <span className="flex size-10 items-center justify-center rounded-md border border-cipher-500/30 bg-cipher-500/10 text-cipher-300">
                    <Coins className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <MachineValue className="block text-[14px] text-text-primary">{featured.symbol}</MachineValue>
                    <MachineValue className="block text-[12px] text-cipher-300">{featured.confSymbol}</MachineValue>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 text-[12.5px] text-text-secondary">
                {["Claim mock asset", "Approve wrapper", "Wrap to confidential twin", "Reveal holder balance"].map((item) => (
                  <div key={item} className="flex items-center gap-2 rounded-md border border-border-hairline bg-surface-raised px-3 py-2">
                    <ShieldCheck className="size-3.5 text-settle-400" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.05fr_1fr]">
          <RegistryLoop pair={featured} />

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border-hairline bg-ink-900 px-5 py-3">
              <span className="text-[13px] font-semibold text-text-primary">Registry-sourced pairs</span>
              <MachineValue className="text-[12px] text-text-tertiary">{pairs.length} valid</MachineValue>
            </div>
            <div className="grid grid-cols-[1.3fr_1.5fr_.8fr] border-b border-border-hairline px-5 py-2 text-[11px] uppercase text-text-tertiary max-md:hidden">
              <span>Asset</span>
              <span>Confidential twin</span>
              <span>Balance</span>
            </div>
            {error ? <div className="border-b border-border-hairline px-5 py-3 text-[12px] text-danger-400">Registry read failed: {error}</div> : null}
            <div className="max-h-[420px] overflow-y-auto">
              {pairs.map((p, i) => (
                <div key={p.conf} className="grid grid-cols-[1.3fr_1.5fr_.8fr] items-center gap-3 border-b border-border-hairline px-5 py-3 last:border-b-0 max-md:grid-cols-1">
                  <span className="min-w-0">
                    <MachineValue className="text-[13px] text-text-primary">{p.symbol}</MachineValue>
                    <MachineValue className="mt-0.5 block truncate text-[11px] text-text-tertiary">{shortAddr(p.token)}</MachineValue>
                  </span>
                  <span className="flex min-w-0 items-center gap-2">
                    <ArrowRight className="size-3.5 shrink-0 text-text-tertiary" />
                    <span className="min-w-0">
                      <MachineValue className="text-[13px] text-cipher-300">{p.confSymbol}</MachineValue>
                      <MachineValue className="mt-0.5 block truncate text-[11px] text-text-tertiary">{shortAddr(p.conf)}</MachineValue>
                    </span>
                  </span>
                  <SealGlyph>{i % 2 === 0 ? "▓▓▓▓" : "▓▓▓▓▓"}</SealGlyph>
                </div>
              ))}
              {!pairs.length && !error ? <div className="px-5 py-8 text-[13px] text-text-secondary">No valid pairs currently returned by the live registry.</div> : null}
            </div>
            <CardFooter className="flex items-center gap-2 bg-ink-900 text-[11.5px] text-text-tertiary">
              <LockKeyhole className="size-3.5 stroke-[1.7]" />
              Balances are sealed on-chain; reveal a position in the wrap loop or with the tool below.
            </CardFooter>
          </Card>
        </div>

        <div className="mt-5">
          <DecryptAny />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-border-hairline bg-surface-raised px-4 py-3">
          <Badge variant="cipher">Vellum test asset</Badge>
          <span className="text-[12.5px] text-text-secondary">
            <MachineValue className="text-cipher-300">cUSDM</MachineValue> is an open-faucet ERC-7984 used by Vellum for distribution demos — not a registry pair.
          </span>
          <a className="ml-auto font-mono text-[12px] text-flow-400 hover:text-flow-300" href={`https://sepolia.etherscan.io/address/${VELLUM_SEPOLIA.cUSDM}`} target="_blank" rel="noreferrer">
            {shortAddr(VELLUM_SEPOLIA.cUSDM)} ↗
          </a>
        </div>
      </main>
    </>
  );
}
