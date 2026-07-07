# Vellum

**Financial agreements that compute while encrypted.**

Vellum is composable confidential finance on [Zama FHEVM](https://docs.zama.org/protocol): assets wrap into
private form, agreements compute on encrypted terms, and payouts reveal only to the holder. It is **one
system, submitted as three track artifacts** for the Zama Developer Program Mainnet Season 3.

**Live on Sepolia · [vellum-production-e698.up.railway.app](https://vellum-production-e698.up.railway.app)**

**🎥 Video walkthrough · [Watch on X](https://x.com/winsznx/status/2074628751476801741)** — the full pitch, with a demo for each track below it.

> Vellum makes financial agreements programmable and confidential: assets wrap into private form, terms
> compute encrypted, and payouts reveal only to the holder.

---

## Three submissions, one system

| Track | Artifact | Deep link | What it proves |
|---|---|---|---|
| **Builder** | Vellum Notes | [`/products`](https://vellum-production-e698.up.railway.app/products) | Confidential structured notes: encrypted terms, on-chain payoff compute, holder-only reveal. |
| **Bounty** | Vellum Registry | [`/registry`](https://vellum-production-e698.up.railway.app/registry) | Production Confidential Wrapper Registry: faucet → approve → wrap → reveal, decrypt any ERC-7984. |
| **Special × TokenOps** | Vellum Distribute | [`/distributions`](https://vellum-production-e698.up.railway.app/distributions) | Confidential disperse via the TokenOps SDK: sealed per-recipient amounts, recipient reveals only their own. |

### Builder — Vellum Notes · [`/products`](https://vellum-production-e698.up.railway.app/products)

Programmable investment agreements whose terms stay encrypted while the payoff still computes on-chain. A
live gold-linked, principal-protected note carries an encrypted `strike` and `leverage`; the payoff is a
capped call spread computed entirely on `euint64` ciphertext, and only the holder can decrypt their outcome.

- **Encrypted:** strike, leverage, the per-holder payoff.
- **Public:** principal, cap (the solvency bound), the Chainlink reference price, settlement status.
- **Judge path:** open the note → read the sealed terms and payoff chart → connect the holder wallet →
  reveal the payoff (EIP-712) → verify settlement on Etherscan.

### Bounty — Vellum Registry · [`/registry`](https://vellum-production-e698.up.railway.app/registry)

The Zama Wrappers Registry as real infrastructure software. Live on-chain read of every ERC-20 ↔ ERC-7984
pair, plus the full confidential-asset loop as real Sepolia transactions.

- **Judge path:** claim the `USDC` faucet → approve the wrapper → wrap into `cUSDT` → reveal the confidential
  balance (EIP-712). A "decrypt any ERC-7984" tool reveals the sealed balance of any confidential token the
  connected wallet holds.

### Special Bounty × TokenOps — Vellum Distribute · [`/distributions`](https://vellum-production-e698.up.railway.app/distributions)

Confidential distribution built on the **TokenOps SDK** `/fhe-disperse` singleton. Per-recipient amounts are
committed on-chain as `externalEuint64` handles under one ZK proof — no plaintext total, no public recipient
list. Each recipient reveals only their own received allocation.

- **Judge path:** review the sealed allocations and the real disperse transaction → connect a recipient
  wallet → reveal only your own allocation (EIP-712). Other recipients and the committed total stay sealed.

## The payoff primitive

```
payoff = principal + min(cap, leverage · max(0, refEnd − strike))
```

A **capped call spread** — principal-protected on the downside, upside capped — computed branchless on
`euint64` ciphertext, with no encrypted division and a single `1e6` scale. `refEnd` is a public Chainlink
price at maturity; the `strike` it is compared against never leaves ciphertext. Overflow is impossible by
construction (`leverage ≤ 1e6`, `delta ≤ 1e12` ⇒ every intermediate `< 2⁶³`). See
[ARCHITECTURE.md](ARCHITECTURE.md).

## Solvency, without revealing terms

At issuance the reserve is funded to `maxPayoff = principal + cap` by **wrapping real USDC** into confidential
cUSDT — a public-amount operation that reverts if underfunded (no silent clamp, no phantom credit). Two public
accumulators let anyone verify `reserveFunded ≥ Σ maxPayoff` on-chain, while every individual note's terms
stay sealed.

## Live contracts (Sepolia, verified)

| Contract | Address | |
|---|---|---|
| `ConfidentialNoteV4` | [`0x130c05fe…955F0`](https://sepolia.etherscan.io/address/0x130c05fe8E96Fa86874d7f8a655C5FADAfF955F0#code) | ✅ verified |
| `OracleAdapter` | [`0x984f8bfa…318BB`](https://sepolia.etherscan.io/address/0x984f8bfa62389e45BdE5cBe23d398a54445318BB#code) | ✅ verified |

Consumed live infrastructure:
[Zama confidential-wrapper registry](https://sepolia.etherscan.io/address/0x2f0750Bbb0A246059d80e94c454586a7F27a128e) ·
[USDC mock](https://sepolia.etherscan.io/address/0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF) →
[cUSDT wrapper](https://sepolia.etherscan.io/address/0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639) ·
[Chainlink XAU/USD](https://sepolia.etherscan.io/address/0xC5981F461d74c46eB4b0CF3f4Ec79f025573B0Ea) ·
[TokenOps /fhe-disperse singleton](https://sepolia.etherscan.io/address/0x710dD9885Cc9986EfD234E7719483147a6d8DBb4) ·
[cUSDM test asset](https://sepolia.etherscan.io/address/0xf7c0cdc1e5f8B79741E78b25D014A7a8f7486B16).

## Stack

- **Contracts** — Solidity 0.8.27, [`@fhevm/solidity`](https://docs.zama.org/protocol) 0.11.1, Hardhat, OpenZeppelin confidential-contracts (ERC-7984).
- **Client** — Next.js 16 · React 19 · viem · wagmi + RainbowKit · [`@zama-fhe/relayer-sdk`](https://github.com/zama-ai/relayer-sdk) for the encrypted reveal.
- **Distribution** — [`@tokenops/sdk`](https://www.npmjs.com/package/@tokenops/sdk) `fhe-disperse` against the live singleton.
- **Oracle** — Chainlink price feeds, TWAP over a settlement window with a maturity-pinned spot fallback.

## Run it

```bash
# contracts — deploy the hardened set + prove the full flow on Sepolia
npm install
cp .env.example .env            # Sepolia test key + RPC + Etherscan key
npx hardhat compile
npx hardhat run scripts/c6-redeploy-hardened.ts --network sepolia

# frontend
cd web && npm install
cp .env.local.example .env.local   # WalletConnect projectId + optional dedicated RPC
npm run dev                        # http://localhost:3939
```

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — contracts, the payoff primitive, solvency model, oracle, decryption flow.
- **[SECURITY.md](SECURITY.md)** — threat model, FHE-specific pitfalls, invariants, what's audited vs not.
- **[ADVERSARIAL-TESTING.md](ADVERSARIAL-TESTING.md)** — the attacks we ran and the on-chain evidence they produced.
- In-app **[/docs](https://vellum-production-e698.up.railway.app/docs)** — the reader-friendly, per-track version.

## Status

Fully functional on Sepolia — wrap, issue, settle, claim, reveal, and confidential distribution all work
end-to-end against real on-chain infrastructure. The sole remaining blocker for mainnet is a formal security
audit; see [SECURITY.md](SECURITY.md).

## License

[BSD-3-Clause-Clear](LICENSE) — matching the Zama FHEVM licensing.
