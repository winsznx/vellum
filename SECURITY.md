# Security

Vellum is a confidential-finance protocol on Zama FHEVM. This document states the threat model, the
FHE-specific pitfalls we defend against, the invariants the contracts hold, and — plainly — what is and
isn't assured. The concrete attacks we ran are in [ADVERSARIAL-TESTING.md](ADVERSARIAL-TESTING.md).

## Status

**Testnet-complete, not audited.** The full lifecycle (issue → settle → claim → reveal → confidential
distribution) works end-to-end on Sepolia against real on-chain infrastructure. The core contracts are
verified on Etherscan. The **sole remaining blocker for mainnet is a formal third-party security audit.**
Do not deposit real value.

## What Vellum protects

- **Confidentiality of terms.** A note's `strike` and `leverage` are `euint64` ciphertext. They are never
  decrypted on-chain, never granted to any address, and never emitted. The payoff computes on them without
  revealing them.
- **Holder-only payoff disclosure.** Only the note holder can decrypt their payoff, via an EIP-712
  user-decryption the contract authorizes with `FHE.allow(payoff, holder)`. Any other wallet is rejected by
  the FHEVM ACL — verified on-chain.
- **Public solvency without disclosure.** Anyone can verify `reserveFunded ≥ Σ maxPayoff` on-chain, proving
  the protocol is funded, while no individual note's terms are exposed. Only the aggregate bound is public.

## Threat model & FHE-specific defenses

FHEVM has failure modes that ordinary Solidity does not. Each is defended explicitly:

| Pitfall (documented by Zama) | Our defense |
|---|---|
| **FHE arithmetic wraps silently — no overflow revert.** | Inputs are clamped on-chain before any multiply: `leverage ≤ 1e6`, `delta ≤ 1e12`, so `leverage·delta ≤ 1e18 < 2⁶³`, and `payoff < 2⁶³` (constructor-asserted). No operation can overflow the `euint64` range. |
| **No revert on a failed encrypted condition.** | The solvency guard is a **public** `require(reserveFunded ≥ sigmaMaxPayoff)`, not an encrypted check — it actually reverts. |
| **ERC-7984 transfer silently clamps on insufficient balance (no revert).** | The public over-collateralization invariant (`reserve ≥ Σ outstanding maxPayoff`, each note pre-funded to its own `maxPayoff`) guarantees the reserve always covers the payout, so the transfer never clamps. |
| **`makePubliclyDecryptable` is global, permanent, irreversible.** | Never called on `payoff`, `delta`, `strike`, or `leverage`. The only public decryption is the ERC-7984 wrapper's unwrap amount — an inherently public ERC-20 figure. |
| **Trivial encryption leaks the constant.** | `FHE.asEuint64` is used only on already-public values (`refEnd`, `0`). |
| **Handles are non-deterministic / not unique — never key state on a ciphertext.** | State is keyed on integer note IDs (`noteCount`), never on a handle. |
| **Leaking the comparison bit or intermediate leaks moneyness/terms.** | The `itm` bool, `rawDelta`, `delta`, `levDelta`, and `capped` are never `allow`-ed to anyone. Only the final `payoff` is granted, only to the holder. |
| **HCU limits — exceeding 20M global / 5M depth reverts the tx.** | `claim()` measures ~1.95M / ~1.6M — ~10× / ~3× headroom. Batch confidential distribution is capped at ≤~12 recipients/tx to stay under the global limit. |

## Invariants

1. `reserveFunded ≥ sigmaMaxPayoff` — always, publicly checkable. No path increments the accumulators
   without a real, reverting wrap.
2. `payoff ∈ [principal, principal + cap]` — encrypted, holder-decrypt only.
3. Every `euint64` intermediate `< 2⁶³` (bounded inputs → no overflow).
4. Settlement is permissionless once the window closes, and settle-once.
5. `claim()` follows checks-effects-interactions: `claimed = true` and the `sigmaMaxPayoff` decrement happen
   **before** the external payout transfer — a reentrant `claim` hits `require(!claimed)`.
6. Only the final per-holder payoff handle is `allow`-ed, and only to the holder.

## Oracle assumptions

- The reference price is a live Chainlink feed (public by design — it's the market price, not a term).
- Settlement uses a window TWAP when the window was sampled, else the feed's price **at maturity** (the
  round covering `windowEnd`), never the mutable current spot — so `settle()` timing is not an option to
  the caller.
- A feed round older than `maxStaleness` is rejected; if no source is fresh, settle reverts (fails closed).
- Window lookup is binary-searched over the observation log, so settlement cost is bounded regardless of how
  many samples exist — closing a gas-DoS found in review.

## Trust boundaries

- **KMS / relayer are not in the trusted base.** Decrypted values are threshold-signed by the KMS and
  verified on-chain (`checkSignatures`); the relayer can at worst censor, and `finalizeUnwrap` is
  permissionless so a holder can self-relay. Terms are never exposed to either.
- **The issuer is trusted only for what's public.** The funded-reserve model means an issuer cannot
  under-collateralize (the wrap reverts), and cannot choose whether/when a note settles (permissionless).
- **Dependencies:** `@openzeppelin/confidential-contracts` is explicitly unaudited by OpenZeppelin; our own
  tests are the assurance on that surface. `@fhevm/solidity` host addresses are inherited from the library
  and confirmed to match the live Sepolia protocol.

## Known limitations (documented, non-blocking for testnet)

- The confidentiality guarantee holds **while value is held as cUSDT**. Unwrapping cUSDT → USDC makes that
  amount public (inherent to any confidential→public bridge).
- `MockConfidentialToken` is an open-faucet test token (Sepolia scaffolding), not a production collateral
  asset.
- Testnet state can be reset by Zama; addresses here are Sepolia-specific.

## Reporting

This is a hackathon-stage project. For a production deployment, a formal audit of `ConfidentialNoteV4` and
`OracleAdapter` (and their FHEVM/ERC-7984 dependencies) is required before any mainnet use.
