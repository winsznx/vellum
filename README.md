# Vellum

**Financial agreements that compute while encrypted.**

Vellum is composable confidential finance on [Zama FHEVM](https://docs.zama.org/protocol). It issues
**confidential principal-protected structured notes**: a note's terms — strike, leverage — stay encrypted
on-chain, the payoff is computed on ciphertext, and only the holder can decrypt their own outcome. Solvency
stays publicly auditable the whole time.

**Live on Sepolia · [vellum-production-e698.up.railway.app](https://vellum-production-e698.up.railway.app)**

---

## The one idea

To compute on a public chain, you normally have to expose the agreement — every counterparty reads your
strike, your size, your leverage. Vellum keeps them **sealed**. Using fully homomorphic encryption, the
note's payoff is calculated directly on encrypted terms:

```
payoff = principal + min(cap, leverage · max(0, refEnd − strike))
```

a **capped call spread** — principal protected on the downside, upside capped — computed entirely on
`euint64` ciphertext, branchless, with no encrypted division. The reference price (`refEnd`) is a public
Chainlink feed; the strike it's compared against never leaves ciphertext. When the note matures, the holder
signs an EIP-712 request and decrypts **their** payoff — nobody else's, and nothing else, is revealed.

## The protocol, in three states

| | Seal | Compute | Reveal |
|---|---|---|---|
| **surface** | Registry | Products | Distributions |
| **what** | wrap a public token into its confidential twin (ERC-7984) | issue a note; payoff settles on encrypted terms | holder decrypts only their own payoff / allocation |
| **on-chain** | `wrap()` — public amount in, sealed balance out | `issue → settle(oracle) → claim` | EIP-712 `userDecrypt`, holder-scoped ACL |

## Solvency, without revealing terms

The hard problem with confidential derivatives is proving they're funded without exposing them. Vellum's
answer: at issuance the reserve is funded to `maxPayoff = principal + cap` by **wrapping real USDC** into
confidential cUSDT — a public-amount operation that reverts if underfunded (no silent clamp, no phantom
credit). Two public accumulators, `reserveFunded` and `sigmaMaxPayoff`, let anyone verify
`reserveFunded ≥ Σ maxPayoff` on-chain — while every individual note's terms stay sealed. Only the
aggregate bound is public; never a single strike or size.

## Live contracts (Sepolia, verified)

| Contract | Address | |
|---|---|---|
| `ConfidentialNoteV4` | [`0x9Bb129E4…0b7322`](https://sepolia.etherscan.io/address/0x9Bb129E4912B9C3e0B2dd74394061d27060b7322#code) | ✅ verified |
| `OracleAdapter` | [`0xD9BE093E…b560D5`](https://sepolia.etherscan.io/address/0xD9BE093EBc43FaB96e45Cd35158E2bf3f6b560D5#code) | ✅ verified |

Consumed live infrastructure: the [Zama confidential-wrapper registry](https://sepolia.etherscan.io/address/0x2f0750Bbb0A246059d80e94c454586a7F27a128e),
its USDC↔cUSDC wrapper, [Chainlink XAU/USD](https://sepolia.etherscan.io/address/0xC5981F461d74c46eB4b0CF3f4Ec79f025573B0Ea),
and the TokenOps `/fhe-disperse` singleton for confidential distributions.

## Stack

- **Contracts** — Solidity 0.8.27, [`@fhevm/solidity`](https://docs.zama.org/protocol) 0.11.1, Hardhat, OpenZeppelin confidential-contracts (ERC-7984).
- **Client** — Next.js 16 · React 19 · viem · wagmi + RainbowKit · [`@zama-fhe/relayer-sdk`](https://github.com/zama-ai/relayer-sdk) for the encrypted reveal.
- **Reference oracle** — Chainlink price feeds, TWAP over a settlement window with a spot fallback.

## Run it

```bash
# contracts
npm install
cp .env.example .env            # add a Sepolia test key + RPC + Etherscan key
npx hardhat compile
npx hardhat run scripts/c5-harden.ts --network sepolia   # deploy + prove the full flow

# frontend
cd web && npm install
cp .env.local.example .env.local   # optional: dedicated RPC + WalletConnect projectId
npm run dev                        # http://localhost:3939
```

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — contracts, the payoff primitive, solvency model, oracle, decryption flow.
- **[SECURITY.md](SECURITY.md)** — threat model, FHE-specific pitfalls, invariants, what's audited vs not.
- **[ADVERSARIAL-TESTING.md](ADVERSARIAL-TESTING.md)** — the attacks we ran and the on-chain evidence they produced.
- **[LICENSE](LICENSE)** — BSD-3-Clause-Clear.

The in-app **[/docs](https://vellum-production-e698.up.railway.app/docs)** page is the reader-friendly version.

## Status

Fully functional on Sepolia testnet — issue, settle, claim, reveal, and confidential distribution all work
end-to-end against real on-chain infrastructure. The sole remaining blocker for mainnet is a formal security
audit; see [SECURITY.md](SECURITY.md).

## License

[BSD-3-Clause-Clear](LICENSE) — matching the Zama FHEVM licensing.
