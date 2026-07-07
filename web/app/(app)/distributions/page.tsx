import { Check, ClipboardCheck, FileCheck2, FileSpreadsheet, LockKeyhole, Send, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Topbar } from "../Topbar";
import { DistributionReceipt } from "./DistributionReceipt";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { MachineValue, SealGlyph, StateDot } from "@/components/vellum/seal";
import { AddressProof, NetworkProof, ProofBar, TxProof } from "@/components/vellum/proof";
import { VELLUM_SEPOLIA, shortAddr } from "@/lib/vellum";

// Real confidential disperse proven on the live TokenOps singleton (3-recipient, encrypted amounts).
const DISPERSE_TX = "0xd8c63e114ce0c35da167d3caae28d04c583dc26ff69afabfdf4c91cebd6667f1";

function WorkflowStep({ n, title, desc, icon: Icon, sealed }: { n: number; title: string; desc: string; icon: typeof ClipboardCheck; sealed?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-border-hairline bg-ink-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-8 items-center justify-center rounded-md border border-flow-500/30 bg-flow-500/10 text-flow-400">
          <Icon className="size-4 stroke-[1.8]" />
        </span>
        <MachineValue className="text-[11px] text-text-tertiary">0{n}</MachineValue>
      </div>
      <div className="mt-3 text-[13px] font-semibold text-text-primary">{title}</div>
      <p className="mt-1 text-[12.5px] leading-5 text-text-secondary">{desc}</p>
      {sealed ? (
        <div className="mt-3">
          <SealGlyph>▓▓▓</SealGlyph>
        </div>
      ) : null}
    </div>
  );
}

export default function DistributionsPage() {
  return (
    <>
      <Topbar crumb={<span className="font-semibold text-text-primary">Distributions</span>} />
      <main className="w-full max-w-[1280px] overflow-x-hidden px-9 py-8 max-sm:px-4">
        <Card className="overflow-hidden">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px] max-sm:p-5">
            <div className="min-w-0">
              <Badge variant="flow">
                <StateDot className="bg-flow shadow-[0_0_8px_var(--flow-500)]" />
                Vellum Distribute
              </Badge>
              <h1 className="mt-4 max-w-[760px] text-[30px] font-semibold leading-tight text-text-primary max-sm:text-[24px]">
                Confidential payroll-style distribution with recipient-private reveals.
              </h1>
              <p className="mt-3 max-w-[74ch] text-[14px] leading-6 text-text-secondary">
                A sender commits sealed token allocations on-chain through the TokenOps SDK. Recipients open the receipt, sign once, and reveal only their own amount.
              </p>
              <ProofBar className="mt-5">
                <span className="text-[12px] text-text-tertiary">Powered by TokenOps SDK</span>
                <AddressProof label="singleton" address={VELLUM_SEPOLIA.disperseSingleton} />
                <TxProof label="disperse" hash={DISPERSE_TX} />
                <NetworkProof />
              </ProofBar>
            </div>

            <div className="grid content-between gap-4 rounded-md border border-border-hairline bg-ink-900 p-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[12px] text-text-tertiary">Committed total</span>
                  <Badge variant="cipher">encrypted</Badge>
                </div>
                <div className="mt-5">
                  <SealGlyph className="text-[21px]">▓▓▓▓▓ cUSDM</SealGlyph>
                </div>
                <p className="mt-3 text-[12.5px] leading-5 text-text-secondary">The recipient count is visible. Per-recipient amounts and the total stay as encrypted handles.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border-hairline bg-surface-raised px-3 py-2">
                  <div className="text-[11px] uppercase text-text-tertiary">Recipients</div>
                  <MachineValue className="mt-1 block text-[18px] text-text-primary">3</MachineValue>
                </div>
                <div className="rounded-md border border-border-hairline bg-surface-raised px-3 py-2">
                  <div className="text-[11px] uppercase text-text-tertiary">Receipt</div>
                  <MachineValue className="mt-1 block text-[18px] text-settle-400">live</MachineValue>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <WorkflowStep n={1} icon={ClipboardCheck} title="Create" desc="Define the distribution register." />
          <WorkflowStep n={2} icon={FileSpreadsheet} title="Upload" desc="Load recipient addresses." />
          <WorkflowStep n={3} icon={LockKeyhole} title="Review" desc="Inspect sealed allocations." sealed />
          <WorkflowStep n={4} icon={Send} title="Commit" desc="Submit the encrypted proof." />
          <WorkflowStep n={5} icon={ShieldCheck} title="Monitor" desc="Track the on-chain receipt." />
          <WorkflowStep n={6} icon={UserCheck} title="Reveal" desc="Recipient decrypts locally." sealed />
        </div>

        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border-hairline bg-ink-900 px-5 py-3">
              <span className="text-[13px] font-semibold text-text-primary">Sealed allocations</span>
              <Badge variant="settle">
                <Check className="size-3.5 stroke-[2.2]" />
                Dispersed on-chain
              </Badge>
            </div>
            <CardContent className="p-5">
              <p className="text-[13px] leading-6 text-text-secondary">
                Allocation dispersed on-chain. Recipient decrypts locally. Amounts are committed as per-recipient <MachineValue className="text-cipher-300">externalEuint64</MachineValue> handles
                under one ZK proof — there is no plaintext total in the calldata, and no recipient can read another&apos;s amount.
              </p>

              <div className="mt-5 overflow-hidden rounded-lg border border-border-hairline">
                <div className="flex items-center justify-between gap-4 border-b border-border-hairline bg-cipher-500/10 px-4 py-3">
                  <span className="flex items-center gap-2 font-mono text-[13px] text-text-primary">
                    <FileCheck2 className="size-3.5 text-settle-400" />
                    recipient
                  </span>
                  <span className="text-[11px] uppercase text-text-tertiary">sealed amount</span>
                </div>
                {["0x71C7…9a3F", "0x3aE9…04bB", "0x9dF2…c18e"].map((r) => (
                  <div key={r} className="flex items-center justify-between gap-4 border-b border-border-hairline px-4 py-3 last:border-b-0">
                    <MachineValue className="text-cipher-300">{r}</MachineValue>
                    <SealGlyph>▓▓▓▓</SealGlyph>
                  </div>
                ))}
                <div className="flex items-center gap-2 bg-ink-900 px-4 py-3 text-[12px] text-text-tertiary">
                  <Users className="size-3.5 text-cipher-400" />
                  Additional recipients stay sealed in the same register. Committed total is encrypted.
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex items-center gap-2 bg-ink-900 text-[11.5px] text-cipher-400">
              <LockKeyhole className="size-3.5 stroke-[1.7]" />
              Per-recipient amounts and the committed total stay encrypted on-chain.
            </CardFooter>
          </Card>

          <div className="grid gap-5">
            <Card className="p-5">
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="reveal">Recipient receipt</Badge>
              </div>
              <p className="mt-2 text-[12.5px] leading-5 text-text-secondary">
                If you received an allocation, connect the recipient wallet and reveal only your own amount. Everyone else&apos;s allocation stays sealed to you.
              </p>
              <div className="mt-4">
                <DistributionReceipt />
              </div>
            </Card>

            <Card className="p-5">
              <h3 className="text-[13.5px] font-semibold text-text-primary">What is verified</h3>
              <ul className="mt-3 grid gap-2 text-[12.5px] leading-5 text-text-secondary">
                {[
                  "The recipient belongs to a distribution committed on-chain.",
                  "Each allocation is sealed on-chain as an encrypted amount.",
                  "A recipient decrypts only their own allocation, locally.",
                  "Other recipients — and the committed total — stay hidden.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-settle-400" />
                    {t}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-md border border-border-hairline bg-surface-raised px-4 py-3 text-[12.5px] text-text-secondary">
          <MachineValue className="text-cipher-300">cUSDM</MachineValue>
          confidential test asset ·
          <a className="font-mono text-flow-400 hover:text-flow-300" href={`https://sepolia.etherscan.io/address/${VELLUM_SEPOLIA.cUSDM}`} target="_blank" rel="noreferrer">
            {shortAddr(VELLUM_SEPOLIA.cUSDM)} ↗
          </a>
        </div>
      </main>
    </>
  );
}
