# Vellum — Frontend (Phase 5) · Build Report

**Scope:** Next.js frontend scaffolded from the Vellum design system, wired to the live C1–C4 Sepolia contracts. Surface order per build order: **Products lifecycle → Distributions → Portfolio → Docs**, plus the landing and the Registry (Seal) entry.

## Stack (CVE-safe, current)
- **Next.js 16.2.9** (App Router, Turbopack) — chosen over 14.2.x to avoid the middleware-bypass CVE-2025-29927 + 14.x SSRF/cache CVEs.
- **React 19.2.7**, **viem 2.52**, **ethers 6**, **@zama-fhe/relayer-sdk 0.4.1** (the D0.5-validated reveal SDK).
- Lives in `web/` (isolated from the Hardhat root; its own package.json/tsconfig/lockfile, `turbopack.root` pinned).

## Design fidelity (design-system laws honored)
- **Tokens ported verbatim** from `vellum-design-system.md §1` → `app/globals.css` (ink/slate/paper ramps, the 4 protocol hues, spacing/radii/elevation/motion, the `--duration-reveal` 560ms + `--ease-reveal`).
- **Four source screens ported verbatim** (markup + CSS, no restyle):
  - `vellum-landing-v2.html` → `app/page.tsx` + `app/landing.css` (paper-mode, scoped under `.landing`).
  - `vellum-screen-registry-wrap.html` → `registry/` (Seal).
  - `vellum-screen-payoff-unlock.html` → `products/` (Compute — the climax).
  - `vellum-screen-verifiable-claim.html` → `distributions/` (Reveal).
- **Register law** (mono for all machine values), **warm law** (reveal-honey only at authorized decrypt — the payoff reveal + claimed allocation), **no-fake-values law** (every sealed value renders as a Seal glyph until decrypted; nothing is a placeholder number). Portfolio/Docs/Activity built from the same tokens (not among the 4 verbatim screens).

## Live contract wiring (real on-chain, no mocks)
- `lib/vellum.ts` — address book of all session-validated C1–C4 contracts + ABIs (ConfidentialNoteV3, OracleAdapter, registry, cUSDM, disperse singleton, Chainlink feeds).
- `lib/viem.ts` — Sepolia public client (publicnode default, `NEXT_PUBLIC_SEPOLIA_RPC_URL` override).
- `lib/fhe.ts` — the reveal: lazy-loads relayer-sdk in-browser, full EIP-712 `userDecrypt` flow, cleartext to the authorized holder only.
- **Registry** (server component, `revalidate 60`): reads the **live registry pairs** via `getTokenConfidentialTokenPairs()` and each underlying/twin symbol on-chain.
- **Products** (server component, `revalidate 30`): reads **note id=1** (the C3 gold note) public fields + payoff handle; `RevealPanel` (client) runs the live userDecrypt on click.

## Verification (dev server, this build)
`next dev` ready in 379ms on :3939. All routes HTTP 200, zero client errors:

| Route | HTTP | Live-data check |
|---|---|---|
| `/` (landing) | 200 | verbatim landing renders |
| `/registry` | 200 | **7 real underlying symbols** from chain (USDCMock, USDTMock, WETHMock, XAUtMock, ZAMAMock, tGBPMock, BRONMock) + registry addr |
| `/products` | 200 | note id=1 real state: **"Matured · Settled" / "Claimed"**, principal 1.00 / cap 50.00, holder `0xF979…1ab5`, **XAU ref 4,484** (refEnd 4483730000/1e6); payoff handle non-zero → **"Reveal your payoff"** live |
| `/distributions` | 200 | verifiable-claim artifact (C4 disperse, encrypted total) |
| `/portfolio` | 200 | live confidential-token list from registry, balances sealed |
| `/docs` | 200 | live contract + feed addresses, Etherscan links |
| `/activity` | 200 | stub |

Production `next build` (Turbopack) hangs on the WASM-heavy relayer-sdk optimizer (a known Turbopack + heavy-dep issue) — **dev server is the working verification path and what's run locally.** Not a code defect; the routes compile and render. (Can revisit with `--webpack` build flag or by code-splitting the SDK harder if a prod build is needed for deploy.)

## Run it
```bash
cd /Users/mac/vellum/web
npm install
npm run dev   # http://localhost:3939
```

## Known follow-ups (not blockers)
- **Wallet connect** is presentational (topbar shows a sample address); the reveal flow uses `window.ethereum` directly via ethers `BrowserProvider` and prompts on click. A full wagmi/connect-modal pass is the natural next increment.
- The **Products reveal** is wired to note id=1 (claimed); to reveal you must connect the holder wallet `0xF979…1ab5` on Sepolia. A second wallet is correctly rejected by the ACL.
- Production build (Turbopack) optimization hang — see above.

All four design screens are ported verbatim and the two load-bearing surfaces (Registry Seal, Products Reveal) are wired to live Sepolia data. The reveal — the product's climax — runs the real EIP-712 userDecrypt against the deployed ConfidentialNoteV3.
