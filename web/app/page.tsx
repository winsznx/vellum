import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, Eye, GitBranch, LockKeyhole, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MachineValue, SealGlyph } from "@/components/vellum/seal";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-paper-100 text-slate-900" data-theme="light">
      <header className="sticky top-0 z-30 flex justify-center px-4 py-4">
        <div className="flex items-center gap-2 rounded-full border border-black/10 bg-paper-0 px-4 py-2 shadow-[0_8px_30px_rgba(11,12,16,.08)]">
          <Link href="/" className="flex items-center gap-2 pr-2">
            <span className="relative size-[22px] rounded-sm bg-[linear-gradient(135deg,var(--cipher-500),var(--flow-500))] after:absolute after:inset-[6px] after:rounded-[2px] after:bg-paper-0" />
            <b className="text-[16px] font-bold">Vellum</b>
          </Link>
          <span className="h-5 w-px bg-black/10 max-md:hidden" />
          <nav className="flex items-center gap-1 max-md:hidden">
            {[
              ["Seal", "#seal"],
              ["Compute", "#compute"],
              ["Reveal", "#reveal"],
              ["Docs", "/docs"],
            ].map(([label, href]) => (
              <Link key={label} href={href} className="rounded-full px-3 py-2 text-[14px] font-medium text-slate-600 hover:bg-black/[0.04] hover:text-slate-900">
                {label}
              </Link>
            ))}
          </nav>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/registry">
              Start sealing
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="bg-[radial-gradient(rgba(11,12,16,.07)_1.4px,transparent_1.5px)] [background-size:22px_22px]">
        <div className="mx-auto max-w-[1280px] px-6 pb-20 pt-16 lg:px-12 lg:pt-24">
          <Badge className="mb-7 border-black/10 bg-paper-0 text-slate-700">
            <LockKeyhole className="size-3.5 text-cipher" />
            Composable confidential finance
          </Badge>
          <h1 className="max-w-[14ch] text-[clamp(48px,9vw,128px)] font-bold leading-[.92] text-slate-950">
            Financial agreements that compute <span className="text-slate-500">while encrypted.</span>
          </h1>
          <p className="mt-7 max-w-[58ch] text-[18px] leading-7 text-slate-700">
            Vellum turns Zama confidential assets into investment products and private distributions: wrap assets, compute payoffs on encrypted terms, and reveal only what belongs to each holder.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/registry">
                Open registry
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <span className="text-[13.5px] text-slate-500">Live on Sepolia · Zama FHEVM</span>
          </div>

          <div className="mt-20 rounded-2xl bg-ink-950 px-8 py-14 text-text-primary shadow-[0_30px_80px_rgba(11,12,16,.18)] lg:px-12">
            <MachineValue className="block text-center text-[11.5px] uppercase text-cipher-400">The protocol, in one line</MachineValue>
            <div className="mt-12 grid items-start gap-5 md:grid-cols-[1fr_80px_1fr_80px_1fr]">
              <ProtocolStage icon={<LockKeyhole />} title="Seal" detail="public asset → confidential twin" state="cipher" />
              <ProtocolRail />
              <ProtocolStage icon={<GitBranch />} title="Compute" detail="payoff on ciphertext" state="cipher" />
              <ProtocolRail warm />
              <ProtocolStage icon={<Eye />} title="Reveal" detail="only to the holder" state="reveal" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-6 pt-6 lg:px-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { tag: "Bounty", title: "Vellum Registry", href: "/registry", desc: "Wrap public tokens into ERC-7984 confidential twins and decrypt balances — live registry, real Sepolia transactions.", variant: "settle" as const },
            { tag: "Builder", title: "Vellum Notes", href: "/products", desc: "Structured notes whose strike and leverage stay encrypted while the payoff computes on-chain.", variant: "cipher" as const },
            { tag: "TokenOps", title: "Vellum Distribute", href: "/distributions", desc: "Confidential disperse via the TokenOps SDK — each recipient reveals only their own allocation.", variant: "flow" as const },
          ].map((t) => (
            <Link key={t.href} href={t.href} className="group rounded-2xl border border-black/10 bg-paper-0 p-6 transition-shadow hover:shadow-[0_16px_40px_rgba(11,12,16,.10)]">
              <Badge variant={t.variant} className="uppercase">{t.tag}</Badge>
              <div className="mt-4 text-[20px] font-bold text-slate-950">{t.title}</div>
              <p className="mt-2 text-[14px] leading-6 text-slate-600">{t.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-flow-600 group-hover:gap-2.5">
                Open <ArrowRight className="size-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section id="seal" className="mx-auto grid max-w-[1240px] gap-10 px-6 py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-12">
        <div>
          <SectionLabel color="cipher">01 · Seal · Registry</SectionLabel>
          <h2 className="max-w-[14ch] text-[46px] font-bold leading-tight text-slate-950">Every asset has a confidential twin.</h2>
          <p className="mt-5 max-w-[48ch] text-[16px] leading-7 text-slate-700">
            Wrap a token from the registry and the balance moves from a public ERC-20 register to a sealed ERC-7984 register. The value remains present and transferable, but unreadable until the holder decrypts.
          </p>
        </div>
        <Card className="overflow-hidden bg-ink-950 text-text-primary">
          <CardContent className="p-0">
            <ProductFrameTitle title="Registry" />
            <div className="p-7">
              <div className="text-[10px] font-semibold uppercase text-slate-400">Public domain</div>
              <MachineValue className="mt-2 block text-[22px] text-slate-300">USDC</MachineValue>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,rgba(131,144,172,.45)_0_7px,transparent_7px_14px)]" />
                <Badge variant="cipher" className="uppercase">
                  <LockKeyhole className="size-3.5" />
                  Seal
                </Badge>
                <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,rgba(131,144,172,.45)_0_7px,transparent_7px_14px)]" />
              </div>
              <div className="text-[10px] font-semibold uppercase text-cipher-400">Private domain</div>
              <div className="mt-2 flex items-baseline gap-4">
                <MachineValue className="text-cipher-300">cUSDC</MachineValue>
                <span className="seal-text font-mono text-[54px] leading-none text-cipher-400">▓▓▓▓▓</span>
              </div>
              <Badge variant="settle" className="mt-5">
                <Check className="size-3.5" />
                Sealed · settled
              </Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <section id="compute" className="mx-auto grid max-w-[1240px] gap-10 px-6 py-20 lg:grid-cols-[1.1fr_.9fr] lg:px-12">
        <Card className="overflow-hidden bg-ink-950 text-text-primary">
          <CardContent className="p-0">
            <ProductFrameTitle title="Products / Capped Call Spread" label="Illustrative" />
            <div className="p-7">
              <div className="text-[12px] text-slate-500">Payoff shape · demonstrative figures</div>
              <svg className="mt-5 block h-auto w-full" viewBox="0 0 560 300" role="img" aria-label="Illustrative capped call-spread payoff shape">
                <g stroke="rgba(255,255,255,.06)" strokeWidth="1">
                  <line x1="44" y1="70" x2="520" y2="70" />
                  <line x1="44" y1="140" x2="520" y2="140" />
                  <line x1="44" y1="230" x2="520" y2="230" />
                </g>
                <line x1="44" y1="40" x2="44" y2="260" stroke="rgba(255,255,255,.16)" />
                <line x1="44" y1="260" x2="520" y2="260" stroke="rgba(255,255,255,.16)" />
                <path d="M44 210 L245 210 L410 88 L520 88" stroke="var(--slate-400)" strokeWidth="2" />
                <line x1="245" y1="210" x2="245" y2="260" stroke="var(--cipher-500)" strokeDasharray="3 4" />
                <text x="245" y="282" textAnchor="middle" fill="var(--cipher-400)" fontFamily="var(--font-mono)" fontSize="12" letterSpacing="2">
                  ▓▓▓
                </text>
                <text x="50" y="202" fill="var(--settle-400)" fontFamily="var(--font-mono)" fontSize="11">
                  floor
                </text>
                <text x="50" y="82" fill="var(--slate-300)" fontFamily="var(--font-mono)" fontSize="11">
                  ceiling
                </text>
              </svg>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-cipher-500/25 bg-cipher-500/10 p-3">
                  <div className="text-[12px] text-slate-400">Strike</div>
                  <SealGlyph className="mt-2">▓▓▓▓</SealGlyph>
                </div>
                <div className="rounded-md border border-cipher-500/25 bg-cipher-500/10 p-3">
                  <div className="text-[12px] text-slate-400">Leverage</div>
                  <SealGlyph className="mt-2">▓▓▓</SealGlyph>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div>
          <SectionLabel color="flow">02 · Compute · Products</SectionLabel>
          <h2 className="max-w-[15ch] text-[46px] font-bold leading-tight text-slate-950">The shape is public. The terms stay sealed.</h2>
          <p className="mt-5 max-w-[48ch] text-[16px] leading-7 text-slate-700">
            A Vellum note publishes the solvency bounds while strike and leverage remain encrypted. Settlement computes the capped call-spread payoff directly on ciphertext.
          </p>
        </div>
      </section>

      <section id="reveal" className="mx-auto grid max-w-[1240px] gap-10 px-6 py-20 lg:grid-cols-[.9fr_1.1fr] lg:px-12">
        <div>
          <SectionLabel color="reveal">03 · Reveal · Holder decrypt</SectionLabel>
          <h2 className="max-w-[15ch] text-[46px] font-bold leading-tight text-slate-950">The warm moment belongs to the holder.</h2>
          <p className="mt-5 max-w-[48ch] text-[16px] leading-7 text-slate-700">
            The final payoff is the only warm state: an authorized holder signs an EIP-712 request and decrypts their own value. A non-holder still sees the seal.
          </p>
        </div>
        <Card className="overflow-hidden bg-ink-950 text-text-primary">
          <CardContent className="p-0">
            <ProductFrameTitle title="Reveal" label="Illustrative" />
            <div className="p-7">
              <div className="text-[12px] text-slate-500">Your payoff · demonstrative</div>
              <MachineValue className="mt-2 block text-[62px] font-medium leading-none text-reveal-400 [text-shadow:0_0_36px_rgba(236,166,58,.32)]">
                52.00<span className="ml-2 text-[20px] text-reveal-300">cUSDT</span>
              </MachineValue>
              <div className="mt-5 flex gap-3 rounded-lg border border-settle-500/25 bg-settle-500/10 p-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-settle-400" />
                <p className="text-[13px] leading-6 text-slate-300">Only the holder can reveal this value. Everyone else receives an ACL rejection and the payoff remains sealed.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-[1240px] px-6 py-20 lg:px-12">
        <SectionLabel color="cipher">Why FHE</SectionLabel>
        <h2 className="max-w-[22ch] text-[46px] font-bold leading-tight text-slate-950">On a public chain, computation used to mean exposure.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Comparison title="Public chain" rows={[["Strike", "visible"], ["Leverage", "visible"], ["Counterparties", "can read terms"]]} />
          <Comparison title="Vellum · FHE" sealed rows={[["Strike", "▓▓▓▓"], ["Leverage", "▓▓▓"], ["Payoff", "computes sealed"]]} />
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-6 py-10 lg:px-12">
        <SectionLabel color="flow">Technical proof · Sepolia · verified on-chain</SectionLabel>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["ConfidentialNote V4", "0x130c05fe8E96Fa86874d7f8a655C5FADAfF955F0"],
            ["OracleAdapter", "0x984f8bfa62389e45BdE5cBe23d398a54445318BB"],
            ["Wrapper registry", "0x2f0750Bbb0A246059d80e94c454586a7F27a128e"],
            ["/fhe-disperse singleton", "0x710dD9885Cc9986EfD234E7719483147a6d8DBb4"],
          ].map(([label, addr]) => (
            <a key={addr} href={`https://sepolia.etherscan.io/address/${addr}`} target="_blank" rel="noreferrer" className="rounded-xl border border-black/10 bg-paper-0 p-4 hover:border-black/25">
              <div className="text-[12px] text-slate-500">{label}</div>
              <div className="mt-1 font-mono text-[12.5px] text-slate-900">
                {addr.slice(0, 10)}…{addr.slice(-6)} ↗
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer className="px-6 pb-12 lg:px-12">
        <div className="mx-auto max-w-[1240px] rounded-2xl bg-ink-950 p-10 text-text-primary lg:p-14">
          <div className="flex flex-wrap gap-4 text-[clamp(44px,8vw,104px)] font-bold leading-none">
            <span className="text-cipher-400">Seal.</span>
            <span className="text-cipher-300">Compute.</span>
            <span className="text-reveal-400 [text-shadow:0_0_50px_rgba(236,166,58,.25)]">Reveal.</span>
          </div>
          <h2 className="mt-8 max-w-[22ch] text-[32px] font-semibold leading-tight">Open the live registry and start from the seal.</h2>
          <p className="mt-3 max-w-[52ch] text-slate-400">The product routes continue into live Sepolia reads: registry pairs, note state, holder decrypt, and contract references.</p>
          <Button asChild size="lg" className="mt-8 rounded-full">
            <Link href="/registry">
              Enter Vellum
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-white/[0.08] pt-6 text-[13.5px] text-slate-400">
            <Link href="/docs" className="hover:text-slate-200">Docs</Link>
            <Link href="/registry" className="hover:text-slate-200">Registry · Bounty</Link>
            <Link href="/products" className="hover:text-slate-200">Notes · Builder</Link>
            <Link href="/distributions" className="hover:text-slate-200">Distribute · TokenOps</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function ProtocolStage({ icon, title, detail, state }: { icon: ReactNode; title: string; detail: string; state: "cipher" | "reveal" }) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className={state === "reveal" ? "flex size-[78px] items-center justify-center rounded-xl border border-reveal-500/50 bg-ink-850 text-reveal-400 shadow-[0_0_50px_rgba(236,166,58,.22)]" : "flex size-[78px] items-center justify-center rounded-xl border border-cipher-500/40 bg-ink-850 text-cipher-400"}>
        <span className="[&_svg]:size-8 [&_svg]:stroke-[1.6]">{icon}</span>
      </div>
      <div className={state === "reveal" ? "mt-4 text-[17px] font-semibold text-reveal-400" : "mt-4 text-[17px] font-semibold text-cipher-300"}>{title}</div>
      <MachineValue className="mt-2 text-[12px] text-slate-500">{detail}</MachineValue>
    </div>
  );
}

function ProtocolRail({ warm = false }: { warm?: boolean }) {
  return <div className={warm ? "mt-[38px] h-0.5 bg-[linear-gradient(90deg,var(--cipher-400),var(--reveal-500))] max-md:hidden" : "mt-[38px] h-0.5 bg-[linear-gradient(90deg,var(--cipher-500),var(--cipher-400))] max-md:hidden"} />;
}

function SectionLabel({ children, color }: { children: ReactNode; color: "cipher" | "flow" | "reveal" }) {
  const dot = color === "cipher" ? "bg-cipher" : color === "flow" ? "bg-flow" : "bg-reveal";
  return (
    <div className="mb-5 flex items-center gap-2 font-mono text-[12px] uppercase text-slate-500">
      <span className={`size-2 rounded-sm ${dot}`} />
      {children}
    </div>
  );
}

function ProductFrameTitle({ title, label }: { title: string; label?: string }) {
  return (
    <div className="flex h-11 items-center justify-between border-b border-white/[0.07] bg-ink-900 px-4">
      <MachineValue className="text-[12px] text-slate-500">{title}</MachineValue>
      {label ? <Badge variant="cipher">{label}</Badge> : <span className="rounded-full border border-flow-500/30 bg-flow-500/10 px-2.5 py-1 text-[11px] text-flow-400">Sepolia</span>}
    </div>
  );
}

function Comparison({ title, rows, sealed = false }: { title: string; rows: [string, string][]; sealed?: boolean }) {
  return (
    <Card className={sealed ? "bg-ink-950 text-text-primary" : "border-black/10 bg-paper-0 text-slate-900"}>
      <CardContent className="p-6">
        <MachineValue className={sealed ? "text-[12px] uppercase text-cipher-400" : "text-[12px] uppercase text-slate-500"}>{title}</MachineValue>
        <div className="mt-4 grid gap-1">
          {rows.map(([k, v]) => (
            <div key={k} className={sealed ? "flex items-center justify-between border-b border-white/[0.07] py-2.5 last:border-b-0" : "flex items-center justify-between border-b border-black/[0.06] py-2.5 last:border-b-0"}>
              <MachineValue className={sealed ? "text-[14px] text-slate-400" : "text-[14px] text-slate-700"}>{k}</MachineValue>
              {sealed && v.startsWith("▓") ? <SealGlyph>{v}</SealGlyph> : <MachineValue className={sealed ? "text-[14px] text-settle-400" : "text-[14px] text-slate-950"}>{v}</MachineValue>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
