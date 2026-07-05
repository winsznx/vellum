# Vellum web — Railway deploy (staged, not yet deployed)

Production build is green via **webpack** (the Turbopack prod optimizer hangs on the WASM-heavy
relayer-sdk). Everything below is configured; deploy is a one-command step when ready.

## What's already set
- `package.json` → `build`: `next build --webpack` + copies `.next/static` (and `public/`) into the
  standalone output. `start`: `node .next/standalone/server.js`.
- `next.config.mjs` → `output: "standalone"`, `outputFileTracingRoot` pinned to `web/`.
- `railway.json` → NIXPACKS, `buildCommand: npm run build`, `startCommand: node .next/standalone/server.js`.
- `.nvmrc` → Node 24.
- RPC: defaults to `https://ethereum-sepolia-rpc.publicnode.com` (in `lib/vellum.ts`); override with the
  `NEXT_PUBLIC_SEPOLIA_RPC_URL` env var (build-time inlined — set it BEFORE the build).
- The standalone server reads `PORT` from env automatically (Railway provides it).

## Deploy (run from `web/`, logged in as winszn)
```bash
cd /Users/mac/vellum/web
railway init                      # create/link a project
# optional dedicated RPC (must be set before build, NEXT_PUBLIC_* is inlined at build time):
railway variables --set NEXT_PUBLIC_SEPOLIA_RPC_URL=<dedicated-sepolia-rpc>
railway up                        # upload + build + deploy
railway domain                    # generate a public URL
```

## Verify after deploy
- `curl -so /dev/null -w "%{http_code}" https://<url>/` and `/registry /products /distributions /portfolio /docs` → all 200.
- `/registry` shows live registry symbols; `/products` shows note id=1 "Matured · Settled / Claimed", XAU ref ~4,484.
- Reveal: connect holder `0xF97933dF45EB549a51Ce4c4e76130c61d08F1ab5` on Sepolia → "Reveal your payoff"
  runs the real EIP-712 userDecrypt; a second wallet is ACL-rejected.

## Note on NEXT_PUBLIC_SEPOLIA_RPC_URL
It's a `NEXT_PUBLIC_*` var → inlined into the client bundle at **build time**. To change the RPC you must
set the variable and then rebuild/redeploy; changing it on a built image has no effect.
```
