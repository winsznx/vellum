# Adversarial Testing

Vellum was hardened through adversarial review, not just happy-path testing. This document records the
attacks and gaps we hunted for, what we found, and the on-chain evidence for each fix. Machine evidence
(transaction hashes, decrypted values, HCU) lives in `internal/evidence/` and the phase reports in
`internal/reports/`.

## Methodology

1. **Canon alignment audit** — the full stack (host addresses, FHE ops, relayer SDK, OpenZeppelin
   ERC-7984, HCU limits) cross-checked against Zama's canonical sources in depth, verifying each claim
   against real source rather than memory.
2. **Adversarial sweep** — a skeptic pass over every contract and frontend file looking for reentrancy,
   overflow/precision, gas-DoS, state-machine races, oracle manipulation, ACL leakage, and any UI that
   claims something the contract doesn't guarantee. Only issues with a concrete failure scenario were
   accepted; each suspected-safe path was checked and recorded as safe.
3. **On-chain proof** — every fix redeployed to Sepolia and exercised with real transactions; results
   re-verified independently (not trusting the run's own logs).

## Findings and fixes (all resolved)

### Settlement liveness — an unsampled window could lock a note forever (HIGH)
`settle()` read a window TWAP that reverted if the window had fewer than two observations, and sampling is
permissionless-but-unincentivized. A window that passed unsampled would make `settle()` revert
**permanently**, locking the holder's payoff and the issuer's collateral.
**Fix:** `OracleAdapter.settlementPrice` returns the window TWAP when ≥2 samples exist, else the feed's
price at maturity — so a note can always settle as long as any source is fresh.
**Proven:** a note issued with a deliberately unsampled window settled via the spot fallback and paid out
the exact expected payoff — the same note reverts forever under the pre-fix contract.

### Permissionless, irrevocable auditor grant (HIGH)
`allowReserveTo(auditor)` had no access control: anyone could grant any address a persistent decrypt on the
reserve balance (which reveals cumulative payout information), and an `FHE.allow` cannot be revoked.
**Fix:** owner-gated (`if (msg.sender != owner) revert NotOwner()`).
**Proven:** a non-owner call reverts; the owner call succeeds.

### Oracle observation array — unbounded log → settlement gas-DoS (HIGH)
`settlementPrice` / `twap` scanned the **entire** append-only observation log to find in-window samples.
Since `observe()` is permissionless and appends forever, an attacker (or ordinary frequent sampling) could
grow the log until the O(n) scan exceeds the block gas limit — bricking `settle()` for **every** note and
locking all reserves.
**Fix:** observations are monotonic in timestamp, so the in-window range is found by **binary search**
(O(log n)); settlement scans only the in-window slice, never the full history.

### Settlement timing option — spot-at-settle, not spot-at-maturity (MEDIUM)
The original spot fallback returned the *current* price when `settle()` was mined. Since `settle()` is
permissionless and first-caller-wins, a holder or issuer could wait for a favorable post-maturity move and
settle then — decoupling the settlement price from maturity.
**Fix:** the spot fallback reads the Chainlink round covering `windowEnd` (via `getRoundData`), pinning the
price to maturity regardless of when `settle()` is actually mined.

### Dead encrypted state (MEDIUM)
An encrypted `notional` was ingested, ACL-authorized, and stored, but never used in the payoff — wasted gas
and an extra persistent ciphertext handle per note.
**Fix:** removed from the struct and the `issue` signature; the note now takes exactly the two encrypted
terms it uses.

### Frontend truthfulness (MEDIUM / LOW)
The project's own "no fake values" design law was violated in the app: a hardcoded connected-wallet address
in the topbar, a fabricated "claimed & settled" distribution view, a stale "Notional" encrypted-term row,
and a dead network toggle.
**Fixes:** the topbar now shows the real RainbowKit/wagmi connection (and the reveal uses the connected
wallet, not `window.ethereum`); the illustrative distribution view is labeled an illustration; the Terms
panel reflects the note's actual encrypted fields; the registry filters on `isValid` so an invalidated pair
never renders as a live twin; the wrong-chain state prompts a switch.

## Verified safe (checked, not skipped)

The adversarial pass explicitly cleared these, with reasoning:

- **`claim()` reentrancy** — checks-effects-interactions holds: `claimed = true` and the `sigmaMaxPayoff`
  decrement precede the external transfer; a reentrant call hits `require(!claimed)`.
- **`sigmaMaxPayoff` underflow** — decrements exactly the `principal+cap` added at issue, once per note.
- **Payoff overflow** — bounded inputs force every intermediate `< 2⁶³`; the OTM subtraction underflow is
  masked by `select`.
- **Per-note solvency** — each issue pre-funds its own `maxPayoff`; the commingled reserve always covers
  outstanding liability.
- **TWAP accumulator / span** — `uint256` accumulator far from overflow; zero-span and same-block samples
  handled.
- **Staleness underflow** (a feed timestamp in the future) — fails closed (treated as stale, reverts).
- **Negative/zero feed answer** — rejected (`BadPrice` / `answer > 0` guards).
- **Products tuple decoding** — the frontend reads the exact V4 struct indices.
- **Server-side RPC reads** — wrapped in try/catch, graceful fallback, no secret leakage (RPC is a
  server-only runtime var).

## Reproduce

The deploy-and-prove scripts are in `scripts/` (`c3-*`, `c4-*`, `c5-harden.ts`, `c6-redeploy-hardened.ts`).
Each deploys to Sepolia and exercises the flow with real transactions; the resulting evidence JSON is written
to `internal/evidence/`.
