"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MachineValue } from "@/components/vellum/seal";
import { cn } from "@/lib/utils";
import { shortAddr } from "@/lib/vellum";

const ex = (a: string) => `https://sepolia.etherscan.io/address/${a}`;

type Props = {
  note: string;
  oracle: string;
  disperse: string;
  registry: string;
  xau: string;
  eth: string;
  btc: string;
};

type Group = "Overview" | "Builder · Notes" | "Bounty · Registry" | "TokenOps · Distribute" | "Reference";
type DocPage = { id: string; group: Group; label: string; body: ReactNode };

const GROUPS: Group[] = ["Overview", "Builder · Notes", "Bounty · Registry", "TokenOps · Distribute", "Reference"];

function Formula({ children }: { children: ReactNode }) {
  return <div className="my-5 rounded-md border border-border-hairline bg-ink-900 px-4 py-3 font-mono text-[13px] leading-6 text-text-primary">{children}</div>;
}

function ReferenceRow({ label, value, href, state = "flow" }: { label: string; value: string; href?: string; state?: "flow" | "settle" | "cipher" }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border-hairline px-4 py-3 last:border-b-0">
      <span className="text-[13px] text-text-secondary">{label}</span>
      {href ? (
        <a className="font-mono text-[12.5px] text-flow-400 hover:text-flow-300" href={href} target="_blank" rel="noreferrer">
          {value} ↗
        </a>
      ) : (
        <MachineValue className={cn("text-[12.5px]", state === "settle" && "text-settle-400", state === "cipher" && "text-cipher-400")}>{value}</MachineValue>
      )}
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <div className="my-5 grid gap-3">
      {items.map((text, i) => (
        <Card key={String(i)} className="flex items-start gap-3 p-4">
          <MachineValue className="flex size-7 shrink-0 items-center justify-center rounded-md border border-flow-500/30 bg-flow-500/10 text-[12px] text-flow-400">{i + 1}</MachineValue>
          <span className="text-[13px] leading-6 text-text-secondary">{text}</span>
        </Card>
      ))}
    </div>
  );
}

function SeeList({ items }: { items: [string, string][] }) {
  return (
    <Card className="my-5 overflow-hidden">
      {items.map(([label, desc]) => (
        <div key={label} className="border-b border-border-hairline px-4 py-3 last:border-b-0">
          <div className="text-[13px] font-medium text-text-primary">{label}</div>
          <div className="mt-1 text-[12.5px] leading-5 text-text-secondary">{desc}</div>
        </div>
      ))}
    </Card>
  );
}

export function DocsView(p: Props) {
  const pages = useMemo<DocPage[]>(
    () => [
      {
        id: "what",
        group: "Overview",
        label: "What is Vellum",
        body: (
          <>
            <p>
              Vellum is composable confidential finance on Zama FHEVM: assets wrap into private form, agreements compute on encrypted terms, and payouts reveal only to the holder. It is one system, presented as
              three artifacts.
            </p>
            <p>
              It runs on fully homomorphic encryption — math executes directly on encrypted numbers, so a value can be present and computable on-chain while staying unreadable to everyone but its owner.
            </p>
          </>
        ),
      },
      {
        id: "tracks",
        group: "Overview",
        label: "The three artifacts",
        body: (
          <>
            <p>The same codebase serves three composable surfaces. Each is a live Sepolia deep link.</p>
            <SeeList
              items={[
                ["Builder · Vellum Notes → /products", "Confidential structured notes: encrypted strike and leverage, on-chain payoff compute, holder-only reveal."],
                ["Bounty · Vellum Registry → /registry", "Confidential Wrapper Registry: faucet → approve → wrap → reveal, and decrypt any ERC-7984 — real Sepolia transactions."],
                ["TokenOps · Vellum Distribute → /distributions", "Confidential disperse via the TokenOps SDK: sealed per-recipient amounts, each recipient reveals only their own."],
              ]}
            />
          </>
        ),
      },
      {
        id: "why",
        group: "Overview",
        label: "Why FHE",
        body: (
          <>
            <p>To compute on a public chain, you normally have to expose the agreement — every counterparty can read your strike, your size, your leverage.</p>
            <p>
              Vellum keeps the terms encrypted end to end. The payoff <span className="text-settle-400">still computes correctly</span> while strike and leverage never leave ciphertext. That is the primitive FHE
              unlocks for public chains, and the thread through all three artifacts.
            </p>
          </>
        ),
      },

      {
        id: "b-lifecycle",
        group: "Builder · Notes",
        label: "Note lifecycle",
        body: (
          <div className="grid gap-3">
            {[
              ["Issue", "Public principal, cap, and settlement window plus encrypted strike and leverage. The reserve is funded by wrapping USDC — a public-amount operation that reverts if underfunded."],
              ["Settle", "Permissionless once the window closes. Finalizes the reference price from the oracle (TWAP over the window, or a maturity-pinned spot fallback)."],
              ["Claim", "Holder-only. Computes the payoff on ciphertext, grants the holder decrypt access, and transfers the encrypted amount via ERC-7984."],
              ["Reveal", "The holder signs an EIP-712 request and decrypts their payoff locally. A non-holder wallet is refused by the FHEVM access-control list."],
            ].map(([title, desc]) => (
              <Card key={title} className="p-4">
                <h3 className="font-mono text-[13px] text-text-primary">{title}</h3>
                <p className="mt-2 text-[13px] leading-6 text-text-secondary">{desc}</p>
              </Card>
            ))}
          </div>
        ),
      },
      {
        id: "b-payoff",
        group: "Builder · Notes",
        label: "The payoff",
        body: (
          <>
            <p>Vellum notes are capped call spreads: principal protected on the downside, upside capped.</p>
            <Formula>payoff = principal + min(cap, leverage · max(0, refEnd − strike))</Formula>
            <SeeList
              items={[
                ["Encrypted", "strike, leverage, and the per-holder payoff — euint64 ciphertext, never granted to anyone but the holder."],
                ["Public", "principal and cap (the solvency bound), the Chainlink reference price refEnd, and settlement status."],
              ]}
            />
            <div className="my-5 flex gap-3 rounded-lg border border-settle-500/25 bg-settle-500/10 p-4">
              <Check className="mt-0.5 size-4 shrink-0 text-settle-400" />
              <p className="text-[13px] leading-6 text-text-secondary">
                <b className="text-settle-400">Overflow is impossible by construction.</b> Inputs are clamped on-chain: leverage &lt;= 1e6, delta &lt;= 1e12, every intermediate stays under 2^63, and there is no
                encrypted division. The whole expression is branchless on <MachineValue>euint64</MachineValue>.
              </p>
            </div>
          </>
        ),
      },
      {
        id: "b-demo",
        group: "Builder · Notes",
        label: "Demo path",
        body: (
          <>
            <p>The live note is a settled gold-linked, principal-protected note on Products.</p>
            <Steps
              items={[
                "Open /products and read the sealed terms and the capped call-spread chart — the strike stays a sealed tick.",
                "Connect the holder wallet on Sepolia (the holder address is shown in the header).",
                "Press Reveal payoff — sign one EIP-712 request and the payoff decrypts locally, warm, for you only.",
                "Follow the note contract link to verify settlement on Etherscan.",
              ]}
            />
          </>
        ),
      },

      {
        id: "r-source",
        group: "Bounty · Registry",
        label: "Registry source",
        body: (
          <>
            <p>
              Registry reads the live Zama Wrappers Registry on Sepolia — every ERC-20 ↔ ERC-7984 pair, on-chain, no hardcoded list. The registry address and pair count are shown in the header as a source anchor.
            </p>
            <Card className="overflow-hidden">
              <ReferenceRow label="Zama Wrappers Registry · Sepolia" value={shortAddr(p.registry)} href={ex(p.registry)} />
            </Card>
          </>
        ),
      },
      {
        id: "r-wrap",
        group: "Bounty · Registry",
        label: "Wrap · reveal · unwrap",
        body: (
          <>
            <p>The full confidential-asset loop runs as real Sepolia transactions on the Registry surface.</p>
            <Steps
              items={[
                "Claim the USDC test faucet (public mint).",
                "Approve the wrapper to pull your USDC.",
                "Wrap USDC into its confidential ERC-7984 twin (cUSDT) — the balance moves to a sealed register.",
                "Reveal the confidential balance locally with an EIP-712 signature — holder-decrypt only.",
              ]}
            />
            <p>Unwrap reverses the wrap through the ERC-7984 two-step confidential→public flow (request, then finalize against a KMS public-decrypt proof), returning the public USDC.</p>
          </>
        ),
      },
      {
        id: "r-decrypt",
        group: "Bounty · Registry",
        label: "Decrypt any ERC-7984",
        body: (
          <>
            <p>
              The registry ships a decrypt utility for <b>any</b> confidential token, not just registered pairs. Paste an ERC-7984 address; Vellum reads your sealed balance handle and reveals it locally with an
              EIP-712 signature.
            </p>
            <div className="my-5 flex gap-3 rounded-lg border border-cipher-500/25 bg-cipher-500/10 p-4">
              <LockKeyhole className="mt-0.5 size-4 shrink-0 text-cipher-400" />
              <p className="text-[13px] leading-6 text-text-secondary">
                The balance decrypts only for the wallet that holds it. A wallet with no balance — or no authorization — receives a seal, never a number.
              </p>
            </div>
          </>
        ),
      },
      {
        id: "r-addpair",
        group: "Bounty · Registry",
        label: "Adding a pair",
        body: (
          <>
            <p>Pairs come from the on-chain registry, so extensibility is a registry write, not an app change.</p>
            <SeeList
              items={[
                ["On-chain source", "The app reads getTokenConfidentialTokenPairs() from the registry — register a new ERC-20 ↔ ERC-7984 wrapper there and it appears live, filtered on isValid."],
                ["Vellum test assets", "cUSDM is an open-faucet ERC-7984 Vellum uses for distribution demos — labeled separately from registry-sourced pairs, never mixed in."],
              ]}
            />
          </>
        ),
      },

      {
        id: "t-sdk",
        group: "TokenOps · Distribute",
        label: "TokenOps SDK",
        body: (
          <>
            <p>
              Vellum Distribute is built on the TokenOps SDK confidential <MachineValue>/fhe-disperse</MachineValue> singleton — a live, consumed contract, never redeployed by Vellum.
            </p>
            <Card className="overflow-hidden">
              <ReferenceRow label="TokenOps /fhe-disperse singleton" value={shortAddr(p.disperse)} href={ex(p.disperse)} />
            </Card>
            <p>Amounts are committed as per-recipient externalEuint64 handles under one ZK proof. There is no plaintext total in the calldata.</p>
          </>
        ),
      },
      {
        id: "t-flow",
        group: "TokenOps · Distribute",
        label: "Sender & recipient",
        body: (
          <>
            <p>Two roles, one confidential distribution.</p>
            <SeeList
              items={[
                ["Sender", "Commits sealed per-recipient allocations on-chain via the SDK disperse. No recipient can read another's amount; the committed total stays encrypted."],
                ["Recipient", "Opens the receipt, connects their wallet, and reveals only their own received allocation with an EIP-712 signature — a reveal, not a claim transaction."],
              ]}
            />
            <p className="text-[13px] text-text-tertiary">Vellum never labels an action “claim” unless it triggers a real claim transaction; the recipient surface is a reveal receipt.</p>
          </>
        ),
      },
      {
        id: "t-privacy",
        group: "TokenOps · Distribute",
        label: "Privacy model",
        body: (
          <>
            <p>What a confidential disperse keeps private, and what it necessarily reveals.</p>
            <SeeList
              items={[
                ["Sealed", "Every per-recipient amount, and the committed total — all encrypted on-chain as ERC-7984 balances."],
                ["Recipient-scoped", "A recipient decrypts only their own allocation; cross-recipient and non-recipient reads are refused by the ACL."],
                ["Leaked (accepted)", "The recipient count N is visible; individual amounts and identities-to-amounts are not."],
              ]}
            />
          </>
        ),
      },

      {
        id: "contracts",
        group: "Reference",
        label: "Live contracts",
        body: (
          <Card className="overflow-hidden">
            <ReferenceRow label="ConfidentialNote V4 · verified" value={shortAddr(p.note)} href={ex(p.note)} />
            <ReferenceRow label="OracleAdapter · verified" value={shortAddr(p.oracle)} href={ex(p.oracle)} />
            <ReferenceRow label="Zama wrapper registry" value={shortAddr(p.registry)} href={ex(p.registry)} />
            <ReferenceRow label="TokenOps /fhe-disperse singleton" value={shortAddr(p.disperse)} href={ex(p.disperse)} />
            <ReferenceRow label="Chainlink XAU / USD · note reference" value={shortAddr(p.xau)} href={ex(p.xau)} />
          </Card>
        ),
      },
      {
        id: "deploy",
        group: "Reference",
        label: "Deployment",
        body: (
          <>
            <p>Everything runs on Sepolia against real on-chain infrastructure — no mocks in the product path.</p>
            <SeeList
              items={[
                ["Live app", "vellum-production-e698.up.railway.app — deep links /registry, /products, /distributions."],
                ["Client", "Next.js 16 · React 19 · viem · wagmi + RainbowKit · @zama-fhe/relayer-sdk for the reveal."],
                ["Contracts", "Solidity 0.8.27 · @fhevm/solidity 0.11.1 · OpenZeppelin confidential-contracts (ERC-7984)."],
                ["Distribution", "@tokenops/sdk fhe-disperse against the live singleton."],
              ]}
            />
            <Formula>cd web && npm install && npm run dev # http://localhost:3939</Formula>
          </>
        ),
      },
      {
        id: "limits",
        group: "Reference",
        label: "Known limitations",
        body: (
          <>
            <p>The current hackathon deployment supports Sepolia and demo product templates.</p>
            <SeeList
              items={[
                ["Confidentiality boundary", "The privacy guarantee holds while value is held as a confidential ERC-7984. Unwrapping to a public ERC-20 makes that amount public — inherent to any confidential→public bridge."],
                ["Note issuance", "The live note is read-only in the UI; issuance runs via the deploy scripts. Create-note is on the roadmap."],
                ["Audit", "Testnet-complete, not audited. The sole remaining blocker for mainnet is a formal third-party security audit; do not deposit real value."],
              ]}
            />
          </>
        ),
      },
    ],
    [p],
  );

  const [idx, setIdx] = useState(0);
  const cur = pages[idx];

  const go = (i: number) => {
    if (i < 0 || i >= pages.length) return;
    setIdx(i);
    window.history.pushState(null, "", `#${pages[i].id}`);
    const pane = document.getElementById("docsPane");
    if (pane) pane.scrollTop = 0;
  };

  useEffect(() => {
    const syncHash = () => {
      const id = window.location.hash.replace(/^#/, "") || new URLSearchParams(window.location.search).get("section") || "what";
      const next = pages.findIndex((page) => page.id === id);
      if (next >= 0) setIdx(next);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, [pages]);

  return (
    <div className="grid h-[calc(100vh-60px)] grid-cols-[282px_1fr] overflow-hidden max-lg:grid-cols-1">
      <nav className="border-r border-border-hairline bg-ink-900 p-5 max-lg:hidden">
        {GROUPS.map((group) => (
          <div key={group} className="mb-6">
            <div className="mb-2 px-2 font-mono text-[11px] uppercase text-text-tertiary">{group}</div>
            <div className="grid gap-1">
              {pages.map((page, i) =>
                page.group === group ? (
                  <button
                    key={page.id}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-2 text-left text-[13px] text-text-secondary transition-colors hover:bg-white/[0.04] hover:text-text-primary",
                      i === idx && "bg-flow-500/10 text-text-primary",
                    )}
                    onClick={() => go(i)}
                  >
                    <MachineValue className={cn("text-[11px] text-text-tertiary", i === idx && "text-flow-400")}>{String(i + 1).padStart(2, "0")}</MachineValue>
                    {page.label}
                  </button>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </nav>

      <div className="overflow-y-auto" id="docsPane">
        <article className="mx-auto max-w-[840px] px-9 py-10 max-sm:px-4">
          <div className="mb-7">
            <MachineValue className="text-[12px] uppercase text-flow-400">{cur.group}</MachineValue>
            <h1 className="mt-3 text-[36px] font-semibold leading-tight text-text-primary max-sm:text-[28px]">{idx === 0 ? "Vellum: confidential structured finance." : cur.label}</h1>
            {idx === 0 && (
              <p className="mt-4 max-w-[68ch] text-[16px] leading-7 text-text-secondary">
                One composable system on Zama FHEVM, submitted as three artifacts: Vellum Notes (Builder), Vellum Registry (Bounty), and Vellum Distribute (TokenOps).
              </p>
            )}
          </div>

          <div className="prose-vellum">{cur.body}</div>

          <div className="mt-10 grid grid-cols-2 gap-3 border-t border-border-hairline pt-5 max-sm:grid-cols-1">
            <Button variant="secondary" className="h-auto justify-start py-3" onClick={() => go(idx - 1)} disabled={idx === 0}>
              <ArrowLeft className="size-4" />
              <span className="text-left">
                <span className="block text-[11px] text-text-tertiary">Previous</span>
                <span>{idx > 0 ? pages[idx - 1].label : "Start"}</span>
              </span>
            </Button>
            <Button variant="secondary" className="h-auto justify-end py-3" onClick={() => go(idx + 1)} disabled={idx === pages.length - 1}>
              <span className="text-right">
                <span className="block text-[11px] text-text-tertiary">Next</span>
                <span>{idx < pages.length - 1 ? pages[idx + 1].label : "Done"}</span>
              </span>
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </article>
      </div>
    </div>
  );
}
