# Architecture

Vellum is three composable surfaces over Zama FHEVM — **Seal** (registry wrap), **Compute** (the note),
**Reveal** (holder decryption + confidential distribution) — plus a Chainlink-backed reference oracle. This
document covers the on-chain design; see [SECURITY.md](SECURITY.md) for the threat model and
[ADVERSARIAL-TESTING.md](ADVERSARIAL-TESTING.md) for the on-chain evidence.

## Contracts

| Contract | Role |
|---|---|
| `ConfidentialNoteV4.sol` | The product. Issues capped call-spread notes; funds the reserve by wrapping USDC; settles from the oracle; pays the encrypted payoff to the holder. |
| `OracleAdapter.sol` | Reference-price oracle over a live Chainlink feed. TWAP over a settlement window, with a maturity-pinned spot fallback and a staleness guard. |
| `MockConfidentialToken.sol` | An ERC-7984 faucet token used as confidential test collateral (Sepolia scaffolding, not core). |

The note builds on OpenZeppelin's ERC-7984 (confidential token standard) and Zama's `@fhevm/solidity`
(`FHE.*` operations on `euint64`, the ACL, and the `ZamaEthereumConfig` host wiring).

## The payoff primitive

```
payoff = principal + min(cap, leverage · max(0, refEnd − strike))
```

A **capped call spread**: a protected floor at `principal`, a linear payoff above the strike, and a ceiling
at `principal + cap`. `principal` and `cap` are public per note (you only need the *bound* public, never the
terms); `strike` and `leverage` are encrypted `euint64`; `refEnd` is the public reference price at maturity.

It's computed **branchless** on ciphertext — FHEVM has no `if` on encrypted values:

```solidity
ebool  itm      = FHE.gt(refEnd, strike);                 // is it in the money?
euint64 rawDelta = FHE.sub(FHE.asEuint64(refEnd), strike);// may underflow-wrap if OTM…
euint64 delta    = FHE.select(itm, rawDelta, FHE.asEuint64(0)); // …discarded by select → max(0,·)
delta            = FHE.min(delta, MAX_DELTA);             // overflow guard
euint64 levDelta = FHE.mul(leverage, delta);
euint64 capped   = FHE.min(levDelta, cap);               // clamp to the cap
euint64 payoff   = FHE.add(capped, principal);           // ∈ [principal, principal+cap]
```

**Overflow is impossible by construction:** `leverage ≤ MAX_LEVERAGE (1e6)` (clamped at issue) and
`delta ≤ MAX_DELTA (1e12)`, so `leverage·delta ≤ 1e18 < 2⁶³`, and `payoff ≤ principal + cap < 2⁶³`
(asserted in the constructor). There is **no encrypted division** — the payoff needs none — and a **single
1e6 scale** (two scaled quantities are never multiplied).

Measured cost of `claim()` (payoff compute + confidential payout transfer): **~1.95M global HCU /
~1.6M depth** — comfortably under FHEVM's 20M global / 5M depth per-transaction limits.

## Solvency: funded reserve, public bound

The reserve is funded to `maxPayoff = principal + cap` at issuance, by **wrapping real USDC** into
confidential cUSDT:

```solidity
require(usdc.transferFrom(msg.sender, address(this), need));  // public pull — reverts if short
usdc.approve(address(cUSDT), need);
cUSDT.wrap(address(this), need);                              // public wrap — reverts if short
reserveFunded  += need;                                       // only AFTER a real wrap
sigmaMaxPayoff += need;
require(reserveFunded >= sigmaMaxPayoff);                      // publicly checkable invariant
```

Because funding is a **public-amount** operation that reverts on shortfall (no encrypted clamp), an
underfunded issue mints no note and moves no accumulator — there is no phantom credit. Anyone can read
`reserveFunded` and `sigmaMaxPayoff` to verify the protocol is solvent, while every individual note's
strike and leverage stay sealed. Only the aggregate bound is public.

## Lifecycle

```
issue ──▶ (settlement window opens) ──▶ settle(oracle) ──▶ claim ──▶ confidential payout to holder
```

- **`issue`** — public `(principal, cap, windowStart, windowEnd)` + encrypted `(strike, leverage)` as a
  ZK-proved input; funds the reserve; stores ACL-scoped terms.
- **`settle`** — permissionless once `block.timestamp ≥ windowEnd`; finalizes `refEnd` from the oracle;
  settle-once. Records `settleMode` (TWAP vs spot) publicly.
- **`claim`** — holder-only; computes the payoff, grants the holder ACL on it, decrements
  `sigmaMaxPayoff`, and transfers the encrypted amount out of the reserve via ERC-7984
  `confidentialTransfer`. CEI order: state is updated before the external transfer.

## The oracle

`OracleAdapter` reads a live Chainlink price feed (XAU/USD as the reference leg; any feed is a constructor
arg). Anyone can `observe()` to log a timestamped sample. At settlement:

- **TWAP** — if ≥2 samples fall in the note's window, a step time-weighted average over that window
  (deterministic, hand-checkable).
- **Spot fallback** — if the window went unsampled, the feed's price **at maturity** (the latest Chainlink
  round with `updatedAt ≤ windowEnd`), so an unsampled window can never permanently lock a note and the
  settlement price stays pinned to maturity rather than to whenever `settle()` happens to be mined.
- **Staleness guard** — a feed round older than `maxStaleness` is rejected; if no source is fresh, settle
  reverts (the genuine oracle-down case).

Window bounds are found by **binary search** over the append-only observation log, so settlement scans only
the in-window slice — never the full (unbounded) history. (This closed a gas-DoS found in adversarial
review; see [ADVERSARIAL-TESTING.md](ADVERSARIAL-TESTING.md).)

## Decryption model

Two distinct paths, matching Zama's guidance:

- **User decryption (EIP-712)** for the holder's payoff — the value is private, so the holder signs a
  time-boxed request and decrypts it client-side via the relayer. Only the address the contract granted ACL
  (`FHE.allow(payoff, holder)`) can do this; a second wallet is rejected on-chain.
- **Public decryption** for the ERC-7984 wrapper's unwrap amount — a real ERC-20 amount is inherently
  public once unwrapped, so it uses the KMS public-decrypt + on-chain `checkSignatures` finalize.

## ACL discipline

The contract grants exactly what's needed and nothing more:

- `FHE.allowThis` on stored terms (`strike`, `leverage`) and the computed `payoff` — the contract retains
  access for cross-transaction use.
- `FHE.allow(payoff, holder)` — **only** the final payoff, **only** to the holder. The comparison bit
  (`itm`), the `delta`, `leverage`, and `strike` are never granted to anyone — leaking any of them would
  reveal moneyness or terms.
- `FHE.allowTransient(payoff, cUSDT)` — a single-transaction grant so the wrapper can compute on the payoff
  during the payout transfer, with no persistent exposure.

## Frontend

Next.js 16 (App Router) + React 19. Server components read public state via viem (registry pairs, note
fields, oracle prices — all live on-chain, no mocks). The reveal is a client boundary: RainbowKit/wagmi
connect the wallet, and `@zama-fhe/relayer-sdk` runs the EIP-712 `userDecrypt` in the browser. The relayer
SDK is dynamically imported so its WASM never enters the server build.

- `Registry` → live confidential-wrapper pairs (`getTokenConfidentialTokenPairs`).
- `Products` → the live note; the payoff curve is a capped call spread with bounds driven by the note's real
  `principal`/`cap`, and the reveal runs the real decrypt (holder-only; a non-holder wallet is ACL-rejected).
- `Distributions` → the confidential-disperse surface (the mechanism is proven on-chain; the sample view is
  labeled an illustration).
- `Portfolio`, `Docs`, `Activity` → confidential balances (sealed), reference, and settlement log.
