import type { ReactNode } from "react";
import { AlertCircle, ArrowRight, Check, Eye, LockKeyhole, ShieldCheck } from "lucide-react";
import { Topbar } from "../Topbar";
import { PayoffSurface } from "./PayoffSurface";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MachineValue, StateDot } from "@/components/vellum/seal";
import { AddressProof, NetworkProof, ProofBar } from "@/components/vellum/proof";
import { cn } from "@/lib/utils";
import { publicClient } from "@/lib/viem";
import { VELLUM_SEPOLIA, NOTE_ABI, shortAddr } from "@/lib/vellum";

export const revalidate = 30;

const NOTE_ID = 0n;

type NoteView = {
  principal: bigint;
  cap: bigint;
  refEnd: bigint;
  settled: boolean;
  claimed: boolean;
  payoffHandle: string;
  holder: string;
};

async function readNote(): Promise<NoteView | null> {
  const client = publicClient();
  try {
    const n = (await client.readContract({
      address: VELLUM_SEPOLIA.confidentialNoteV3 as `0x${string}`,
      abi: NOTE_ABI,
      functionName: "notes",
      args: [NOTE_ID],
    })) as readonly unknown[];

    const payoffHandle = (await client.readContract({
      address: VELLUM_SEPOLIA.confidentialNoteV3 as `0x${string}`,
      abi: NOTE_ABI,
      functionName: "getPayoff",
      args: [NOTE_ID],
    })) as string;

    return {
      holder: n[1] as string,
      principal: n[2] as bigint,
      cap: n[3] as bigint,
      refEnd: n[8] as bigint,
      settled: n[10] as boolean,
      claimed: n[11] as boolean,
      payoffHandle,
    };
  } catch {
    return null;
  }
}

function ValueTile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-border-hairline bg-ink-900 px-4 py-3">
      <div className="text-[11px] uppercase text-text-tertiary">{label}</div>
      <div className="mt-2 text-[13px] text-text-primary">{children}</div>
    </div>
  );
}

function WhyTile({ icon: Icon, title, desc, tone }: { icon: typeof LockKeyhole; title: string; desc: string; tone: "cipher" | "settle" | "reveal" }) {
  const toneClass = {
    cipher: "border-cipher-500/25 bg-cipher-500/10 text-cipher-300",
    settle: "border-settle-500/25 bg-settle-500/10 text-settle-400",
    reveal: "border-reveal-500/25 bg-reveal-500/10 text-reveal-400",
  }[tone];
  return (
    <Card className="p-5">
      <span className={cn("flex size-9 items-center justify-center rounded-md border", toneClass)}>
        <Icon className="size-4 stroke-[1.8]" />
      </span>
      <div className="mt-4 text-[13.5px] font-semibold text-text-primary">{title}</div>
      <p className="mt-1 text-[12.5px] leading-5 text-text-secondary">{desc}</p>
    </Card>
  );
}

export default async function ProductsPage() {
  const note = await readNote();
  const refEndUsd = note ? (Number(note.refEnd) / 1e6).toLocaleString("en-US", { maximumFractionDigits: 0 }) : null;

  return (
    <>
      <Topbar
        crumb={
          <>
            <span className="font-medium text-text-secondary">Products</span>
            <span className="mx-2 text-text-tertiary">/</span>
            <span className="font-semibold text-text-primary">Gold-Linked PPN</span>
          </>
        }
      />
      <main className="w-full max-w-[1200px] overflow-x-hidden px-9 py-8 max-sm:px-4">
        <Card className="overflow-hidden">
          <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_360px] max-sm:p-5">
            <div className="min-w-0">
              <Badge variant="cipher">
                <StateDot className="bg-cipher shadow-[0_0_8px_var(--cipher-500)]" />
                Vellum Notes
              </Badge>
              <h1 className="mt-4 max-w-[760px] break-words text-[30px] font-semibold leading-tight text-text-primary max-sm:text-[24px]">
                Gold-Linked Principal-Protected Note
              </h1>
              <p className="mt-3 max-w-[74ch] text-[14px] leading-6 text-text-secondary">
                Programmable investment agreements with encrypted terms and on-chain payoff computation. Strike and leverage stay sealed; the payoff computes on ciphertext and unlocks only for the holder.
              </p>
              {note ? (
                <ProofBar className="mt-5">
                  <AddressProof label="note" address={VELLUM_SEPOLIA.confidentialNoteV3} />
                  <AddressProof label="oracle" address={VELLUM_SEPOLIA.oracleAdapter} />
                  <NetworkProof />
                </ProofBar>
              ) : null}
            </div>

            <div className="grid content-between gap-4 rounded-md border border-border-hairline bg-ink-900 p-4">
              <div className="flex items-center justify-between gap-3">
                {note?.settled ? (
                  <Badge variant="settle">
                    <StateDot className="bg-settle" />
                    Matured · Settled
                  </Badge>
                ) : (
                  <Badge variant="cipher">
                    <StateDot className="bg-cipher" />
                    Sealed · Open
                  </Badge>
                )}
                <MachineValue className="text-[12px] text-text-tertiary">#{NOTE_ID.toString()}</MachineValue>
              </div>

              <div className="grid gap-2">
                <ValueTile label="Holder">
                  <MachineValue>{note ? shortAddr(note.holder) : "unavailable"}</MachineValue>
                </ValueTile>
                <ValueTile label="Reference">
                  <MachineValue>XAU/USD</MachineValue> <span className="text-text-tertiary">at maturity</span>
                </ValueTile>
                <ValueTile label="Encrypted terms">
                  <span className="inline-flex items-center gap-2">
                    <LockKeyhole className="size-3.5 text-cipher-400" />
                    strike and leverage sealed
                  </span>
                </ValueTile>
              </div>
            </div>
          </div>

          {note ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border-hairline bg-ink-900 px-6 py-4 text-[12px] max-sm:px-5">
              {([["Issued", true], ["Settled", note.settled], ["Claimed", note.claimed], ["Holder reveal", note.claimed]] as const).map(([label, done], i, arr) => (
                <span key={label} className="inline-flex items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1", done ? "border-settle-500/30 bg-settle-500/10 text-settle-400" : "border-border-hairline bg-surface-raised text-text-tertiary")}>
                    {done ? <Check className="size-3" /> : null}
                    {label}
                  </span>
                  {i < arr.length - 1 ? <ArrowRight className="size-3 text-text-tertiary" /> : null}
                </span>
              ))}
            </div>
          ) : null}
        </Card>

        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <WhyTile icon={LockKeyhole} tone="cipher" title="Terms stay encrypted" desc="Strike, leverage, and payoff handles are stored as ciphertext, not hidden by the frontend." />
          <WhyTile icon={ShieldCheck} tone="settle" title="Payoff computes on-chain" desc="The settlement path executes against deployed Sepolia contracts and oracle references." />
          <WhyTile icon={Eye} tone="reveal" title="Holder-only reveal" desc="The result decrypts locally after the authorized holder signs an EIP-712 request." />
        </div>

        {!note ? (
          <Card className="mt-7">
            <CardContent className="flex items-start gap-3 p-6 text-[13px] text-text-secondary">
              <AlertCircle className="mt-0.5 size-4 text-danger-400" />
              The live note could not be read from Sepolia. The surface is intentionally empty rather than showing fabricated terms.
            </CardContent>
          </Card>
        ) : (
          <PayoffSurface
            principal6={note.principal.toString()}
            cap6={note.cap.toString()}
            refEndUsd={refEndUsd ?? "unavailable"}
            payoffHandle={note.payoffHandle}
            claimed={note.claimed}
            settled={note.settled}
            holder={note.holder}
            noteContract={VELLUM_SEPOLIA.confidentialNoteV3}
          />
        )}
      </main>
    </>
  );
}
