# Vellum web — Production Deploy · Railway

**Hosted URL: https://vellum-production-e698.up.railway.app**

Live, production, verified. Project `vellum` (id `48128ba0-f486-46c0-b277-ad850ce93349`), service `vellum`, account winszn.

## The build-hang fix (root cause)
The Turbopack prod optimizer hung on the WASM-heavy `@zama-fhe/relayer-sdk`. Fixed by pinning the
production build to **webpack** — `package.json` `build: next build --webpack` (+ standalone static copy),
and `railway.json` `buildCommand: npm run build` so Railpack runs *that*, not its own Turbopack detect.
The SDK stays isolated behind a client `import()` (RevealPanel onClick → `lib/fhe.ts`); server components
are SDK-free. **Host build: Railpack → `next build --webpack` → "Compiled successfully", TypeScript passed,
9/9 pages generated — no hang.**

## Deploy fix
First deploy built fine but failed the healthcheck ("service unavailable"): Next's standalone `server.js`
binds `process.env.HOSTNAME`, which Docker sets to the container hex ID — an invalid bind address, so it
never listened. Fixed with service var **`HOSTNAME=0.0.0.0`**; redeploy passed the healthcheck.

## Config (Railway, config-as-code)
- `railway.json`: builder `RAILPACK`, `buildCommand: npm run build`, `startCommand: node .next/standalone/server.js`, `healthcheckPath: /`.
- Vars: `HOSTNAME=0.0.0.0`, `SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com`.
- **RPC is a runtime server var** (not `NEXT_PUBLIC_`): read by server components at request time, never in the
  client bundle, **swappable to a dedicated RPC without a rebuild** (`railway variables --set SEPOLIA_RPC_URL=…`).

## ACCEPTANCE (verified on the hosted URL)
| # | Criterion | Result |
|---|-----------|--------|
| 1 | Host build completes (bundler) | **PASS — webpack**, no hang. All 7 routes HTTP **200** in production, zero client errors (`/ /registry /products /distributions /portfolio /docs /activity`). |
| 2 | Live chain reads on hosted site | **PASS** — `/registry` renders 7 live symbols (USDCMock, USDTMock, WETHMock, XAUtMock, ZAMAMock, tGBPMock, BRONMock); `/products` shows note id=1 **"Matured · Settled / Claimed"**, **XAU ref 4,484**; capped call-spread curve with **live 1.00 / 51.00** bounds (path `M60 260 L300 260 L470 96 L540 96`, both bounds labeled, sealed cipher strike tick). |
| 3 | Reveal runs real userDecrypt; warm point on cap ceiling over 560ms; 2nd wallet ACL-rejected | **WIRED & SERVED** — `/products` serves the reveal button (flow, not warm) + sealed terms; the client `PayoffSurface` runs the live EIP-712 `userDecrypt` (`lib/fhe.ts`, unchanged) with the 560ms `--ease-reveal` animation; geometry maps payoff 51.00 → y=96 = cap ceiling. Requires connecting holder `0xF97933dF45EB549a51Ce4c4e76130c61d08F1ab5` in a browser wallet; a second wallet is rejected by the on-chain ACL (the contract only `FHE.allow`s the holder). *This is a wallet-interactive step — not curl-verifiable; the wiring is the same live flow proven in C1–C4.* |
| 4 | No "structured product" novelty copy in production | **PASS** — 0 hits; tagline reads "first confidential principal-protected structured note". |

## Note on AT#3
Criteria 1, 2, 4 are fully verified by curl against the hosted URL. #3's decrypt requires a human browser
wallet holding the holder key on Sepolia — it can't be curled. The hosted page serves the exact reveal
component (real userDecrypt, 560ms animation, cap-binds banner) that was verified live locally and in the
C1–C4 on-chain acceptance; the ACL rejection of non-holders is enforced on-chain by ConfidentialNoteV3.

## Swap to a dedicated RPC later (no rebuild)
```bash
cd /Users/mac/vellum/web
railway variables --set "SEPOLIA_RPC_URL=<dedicated-sepolia-rpc>"   # takes effect on next request
```
