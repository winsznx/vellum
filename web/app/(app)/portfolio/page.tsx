import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, ArrowRight, Boxes, ChartNoAxesCombined, Check, LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { Topbar } from "../Topbar";
import { PortfolioPositions, type PortfolioToken } from "./PortfolioPositions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MachineValue, SealGlyph, StateDot } from "@/components/vellum/seal";
import { AddressProof, NetworkProof, ProofBar, TextProof } from "@/components/vellum/proof";
import { publicClient } from "@/lib/viem";
import { REGISTRY, REGISTRY_ABI, ERC7984_ABI, NOTE_ABI, SEPOLIA_CHAIN_ID, VELLUM_SEPOLIA, shortAddr } from "@/lib/vellum";

export const revalidate = 60;

async function readConfTokens(): Promise<PortfolioToken[]> {
  try {
    const client = publicClient();
    const raw = (await client.readContract({
      address: REGISTRY[SEPOLIA_CHAIN_ID] as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "getTokenConfidentialTokenPairs",
    })) as readonly { confidentialTokenAddress: string; isValid: boolean }[];

    return Promise.all(
      raw
        .filter((p) => p.isValid)
        .slice(0, 8)
        .map(async (p) => {
          const [symbol, decimals] = await Promise.all([
            client.readContract({ address: p.confidentialTokenAddress as `0x${string}`, abi: ERC7984_ABI, functionName: "symbol" }).catch(() => "cToken"),
            client.readContract({ address: p.confidentialTokenAddress as `0x${string}`, abi: ERC7984_ABI, functionName: "decimals" }).catch(() => 6),
          ]);
          return { symbol: String(symbol), address: p.confidentialTokenAddress, decimals: Number(decimals) };
        }),
    );
  } catch {
    return [];
  }
}

type NoteRow = { holder: string; principal: bigint; cap: bigint; settled: boolean; claimed: boolean };

async function readNote(): Promise<NoteRow | null> {
  try {
    const client = publicClient();
    const n = (await client.readContract({ address: VELLUM_SEPOLIA.confidentialNoteV3 as `0x${string}`, abi: NOTE_ABI, functionName: "notes", args: [0n] })) as readonly unknown[];
    return { holder: n[1] as string, principal: n[2] as bigint, cap: n[3] as bigint, settled: n[10] as boolean, claimed: n[11] as boolean };
  } catch {
    return null;
  }
}

function ActionLink({ href, icon: Icon, label }: { href: string; icon: typeof Boxes; label: string }) {
  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={href}>
        <Icon className="size-4" />
        {label}
      </Link>
    </Button>
  );
}

function ChecklistRow({ children, done = true }: { children: ReactNode; done?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 border-b border-border-hairline px-4 py-3 last:border-b-0">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border border-settle-500/30 bg-settle-500/10 text-settle-400">
        {done ? <Check className="size-3" /> : <LockKeyhole className="size-3" />}
      </span>
      <span className="text-[12.5px] leading-5 text-text-secondary">{children}</span>
    </div>
  );
}

export default async function PortfolioPage() {
  const [tokens, note] = await Promise.all([readConfTokens(), readNote()]);
  const maxPayoff = note ? (Number(note.principal + note.cap) / 1e6).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;
  const noteStatus = note ? (note.claimed ? "Claimed" : note.settled ? "Settled" : "Open") : "Unavailable";

  return (
    <>
      <Topbar crumb={<span className="font-semibold text-text-primary">Portfolio</span>} />
      <main className="w-full max-w-[1280px] overflow-x-hidden px-9 py-8 max-sm:px-4">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_360px]">
          <div className="grid min-w-0 gap-5">
            <Card className="overflow-hidden">
              <div className="grid min-h-[252px] gap-5 p-6 md:grid-cols-[minmax(0,1fr)_280px] max-sm:p-5">
                <div className="flex min-w-0 flex-col justify-between">
                  <div>
                    <Badge variant="cipher">
                      <StateDot className="bg-cipher shadow-[0_0_8px_var(--cipher-500)]" />
                      Confidential portfolio
                    </Badge>
                    <h1 className="mt-4 max-w-[760px] text-[30px] font-semibold leading-tight text-text-primary max-sm:text-[24px]">
                      Your balances stay sealed until your wallet reveals them.
                    </h1>
                    <p className="mt-3 max-w-[70ch] text-[14px] leading-6 text-text-secondary">
                      Vellum reads live ERC-7984 positions from Sepolia. The dashboard can show ownership, contracts, and state immediately; only the connected holder can decrypt a balance locally.
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-2">
                    <ActionLink href="/registry" icon={Boxes} label="Wrap assets" />
                    <ActionLink href="/products" icon={ChartNoAxesCombined} label="Open note" />
                    <ActionLink href="/activity" icon={Activity} label="View activity" />
                  </div>
                </div>

                <div className="grid content-between gap-4 rounded-md border border-border-hairline bg-ink-900 p-4">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12px] text-text-tertiary">Portfolio value</span>
                      <Badge variant="cipher">sealed</Badge>
                    </div>
                    <div className="mt-5">
                      <SealGlyph className="text-[21px]">▓▓▓▓▓</SealGlyph>
                    </div>
                    <p className="mt-3 text-[12.5px] leading-5 text-text-secondary">No aggregate plaintext total is calculated. Reveal happens per asset or per payoff handle.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-border-hairline bg-surface-raised px-3 py-2">
                      <div className="text-[11px] uppercase text-text-tertiary">Assets</div>
                      <MachineValue className="mt-1 block text-[18px] text-text-primary">{tokens.length}</MachineValue>
                    </div>
                    <div className="rounded-md border border-border-hairline bg-surface-raised px-3 py-2">
                      <div className="text-[11px] uppercase text-text-tertiary">Notes</div>
                      <MachineValue className="mt-1 block text-[18px] text-text-primary">{note ? 1 : 0}</MachineValue>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-border-hairline bg-ink-900 px-6 py-4 max-sm:px-5">
                <ProofBar>
                  <span className="text-[12px] text-text-tertiary">Live read anchors</span>
                  <AddressProof label="registry" address={REGISTRY[SEPOLIA_CHAIN_ID]} />
                  <TextProof label="pairs" value={String(tokens.length)} />
                  <NetworkProof />
                </ProofBar>
              </div>
            </Card>

            <PortfolioPositions tokens={tokens} />
          </div>

          <aside className="grid min-w-0 gap-5">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-border-hairline bg-ink-900 px-5 py-3">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
                  <WalletCards className="size-4 text-cipher-400" />
                  Note position
                </span>
                <Badge variant={note?.settled ? "settle" : "cipher"}>{noteStatus}</Badge>
              </div>

              {note ? (
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <MachineValue className="text-[15px] font-semibold text-text-primary">Gold-Linked PPN</MachineValue>
                      <div className="mt-1 text-[12px] text-text-tertiary">Principal-protected confidential payoff</div>
                    </div>
                    <SealGlyph>▓▓▓ cUSDT</SealGlyph>
                  </div>

                  <div className="mt-5 grid gap-2">
                    {[
                      ["Holder", shortAddr(note.holder)],
                      ["Max payoff", `${maxPayoff} cUSDT`],
                      ["Payoff", "holder decrypt only"],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-border-hairline bg-ink-900 px-3 py-2">
                        <span className="text-[12px] text-text-tertiary">{label}</span>
                        <MachineValue className="text-[12.5px] text-text-secondary">{value}</MachineValue>
                      </div>
                    ))}
                  </div>

                  <Button asChild className="mt-5 w-full" variant="secondary">
                    <Link href="/products">
                      Open payoff surface <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="p-5 text-[13px] leading-6 text-text-secondary">No live note could be read from Sepolia. Vellum leaves the panel empty instead of inventing a position.</div>
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-border-hairline bg-ink-900 px-5 py-3 text-[13px] font-semibold text-text-primary">
                <ShieldCheck className="size-4 text-settle-400" />
                Privacy posture
              </div>
              <ChecklistRow>Contract addresses, pair counts, and note state are public proof anchors.</ChecklistRow>
              <ChecklistRow>Asset balances render as ciphertext until the holder signs an EIP-712 decrypt request.</ChecklistRow>
              <ChecklistRow>Aggregate value is not computed in plaintext; every reveal is scoped to one handle.</ChecklistRow>
              <ChecklistRow>Unauthorized wallets keep seeing seals instead of numbers.</ChecklistRow>
            </Card>
          </aside>
        </div>
      </main>
    </>
  );
}
