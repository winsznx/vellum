// Vellum contract address book — all addresses validated on Sepolia this build (C1–C4).
// Real, on-chain, evidence-backed. No placeholders (design law #6 + build law: real only).

export const SEPOLIA_CHAIN_ID = 11155111 as const;
export const MAINNET_CHAIN_ID = 1 as const;

// RPC is used ONLY by server components (viem reads). Prefer a server-only runtime var so a
// dedicated RPC can be swapped on Railway without a rebuild (never shipped to the client bundle).
// NEXT_PUBLIC_* kept as a fallback for backward compat; publicnode is the last-resort default.
export const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ??
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
  "https://ethereum-sepolia-rpc.publicnode.com";

// Confidential-wrapper registry (real, Zama). getTokenConfidentialTokenPairs() selector 0xf63a0980.
export const REGISTRY = {
  [SEPOLIA_CHAIN_ID]: "0x2f0750Bbb0A246059d80e94c454586a7F27a128e",
  [MAINNET_CHAIN_ID]: "0xeb5015fF021DB115aCe010f23F55C2591059bBA0",
} as const;

// Vellum contracts deployed + acceptance-passed on Sepolia (see C1–C4 reports).
export const VELLUM_SEPOLIA = {
  // ConfidentialNoteV4 (audit-hardened): wrap-funded reserve, confidential payout, settlement-liveness
  // fallback, owner-gated auditor grant. Verified on Etherscan. (Key kept as confidentialNoteV3 to avoid
  // churn across call sites; the value is the current live V4 note.)
  confidentialNoteV3: "0x130c05fe8E96Fa86874d7f8a655C5FADAfF955F0",
  // OracleAdapter (hardened): binary-search window bounds (no gas-DoS) + maturity-pinned spot fallback.
  oracleAdapter: "0x984f8bfa62389e45BdE5cBe23d398a54445318BB",
  // D0/C1 cUSDM faucet token (ERC-7984) — disperse + note-coupon scaffolding.
  cUSDM: "0xf7c0cdc1e5f8B79741E78b25D014A7a8f7486B16",
  // Underlying USDC mock (public mint faucet, 6dp) — wraps into the registry's cUSDT.
  usdc: "0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF",
  // Confidential wrapper for the USDC mock (ERC-7984 · cUSDT). wrap/unwrap round-trip proven on-chain.
  wrapperCUSDT: "0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639",
  // Live TokenOps /fhe-disperse singleton (D0.3-validated; consumed, never redeployed).
  disperseSingleton: "0x710dD9885Cc9986EfD234E7719483147a6d8DBb4",
} as const;

// Sepolia explorer helpers — every proof anchor links to a real on-chain artifact.
export const EXPLORER = "https://sepolia.etherscan.io";
export const etherscanAddr = (a: string) => `${EXPLORER}/address/${a}`;
export const etherscanTx = (h: string) => `${EXPLORER}/tx/${h}`;
export const NETWORK_LABEL = "Sepolia";

// Live Chainlink price feeds on Sepolia (verified on-chain, 8 decimals).
export const FEEDS_SEPOLIA = {
  ethUsd: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  btcUsd: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
  xauUsd: "0xC5981F461d74c46eB4b0CF3f4Ec79f025573B0Ea",
  gbpUsd: "0x91FAB41F5f3bE955963a986366edAcff1aaeaa83",
  eurUsd: "0x1a81afB8146aeFfCFc5E50e8479e826E7D55b910",
} as const;

// ── ABIs (minimal, only what the surfaces call) ──────────────────────────────

export const REGISTRY_ABI = [
  {
    type: "function",
    name: "getTokenConfidentialTokenPairs",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "tokenAddress", type: "address" },
          { name: "confidentialTokenAddress", type: "address" },
          { name: "isValid", type: "bool" },
        ],
      },
    ],
  },
] as const;

export const ERC20_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

// Confidential ERC-7984 wrapper (USDC ↔ cUSDT). Public wrap in; 2-step confidential→public unwrap out.
export const WRAPPER_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "rate", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "underlying", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "confidentialBalanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "wrap", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "uint256" }] },
  {
    type: "function", name: "unwrap", stateMutability: "nonpayable",
    inputs: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "encryptedAmount", type: "bytes32" }, { name: "inputProof", type: "bytes" }],
    outputs: [{ type: "bytes32" }],
  },
  { type: "function", name: "unwrapAmount", stateMutability: "view", inputs: [{ type: "bytes32" }], outputs: [{ type: "bytes32" }] },
  {
    type: "function", name: "finalizeUnwrap", stateMutability: "nonpayable",
    inputs: [{ name: "unwrapRequestId", type: "bytes32" }, { name: "unwrapAmountCleartext", type: "uint64" }, { name: "decryptionProof", type: "bytes" }], outputs: [],
  },
] as const;

// ERC-7984 faucet token (cUSDM) — open mint + operator authorization for the disperse singleton.
export const FAUCET7984_ABI = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint64" }], outputs: [] },
  { type: "function", name: "setOperator", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint48" }], outputs: [] },
  { type: "function", name: "isOperator", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "confidentialBalanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bytes32" }] },
] as const;

export const ERC7984_ABI = [
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "confidentialBalanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "isOperator", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "bool" }] },
] as const;

export const NOTE_ABI = [
  { type: "function", name: "noteCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "reserveFunded", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "sigmaMaxPayoff", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  {
    type: "function",
    name: "notes",
    stateMutability: "view",
    inputs: [{ type: "uint256" }],
    outputs: [
      { name: "issuer", type: "address" },
      { name: "holder", type: "address" },
      { name: "principal", type: "uint64" },
      { name: "cap", type: "uint64" },
      { name: "strike", type: "bytes32" },
      { name: "leverage", type: "bytes32" },
      { name: "windowStart", type: "uint64" },
      { name: "windowEnd", type: "uint64" },
      { name: "refEnd", type: "uint64" },
      { name: "settleMode", type: "uint8" },
      { name: "settled", type: "bool" },
      { name: "claimed", type: "bool" },
      { name: "payoff", type: "bytes32" },
    ],
  },
  { type: "function", name: "getPayoff", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "getRefEnd", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint64" }] },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] },
  {
    type: "event", name: "Issued",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "issuer", type: "address", indexed: true },
      { name: "holder", type: "address", indexed: true },
      { name: "principal", type: "uint64", indexed: false },
      { name: "cap", type: "uint64", indexed: false },
      { name: "windowStart", type: "uint64", indexed: false },
      { name: "windowEnd", type: "uint64", indexed: false },
      { name: "wrapped", type: "uint256", indexed: false },
    ],
  },
  { type: "event", name: "Settled", inputs: [{ name: "id", type: "uint256", indexed: true }, { name: "refEnd", type: "uint64", indexed: false }, { name: "mode", type: "uint8", indexed: false }] },
  { type: "event", name: "Claimed", inputs: [{ name: "id", type: "uint256", indexed: true }, { name: "holder", type: "address", indexed: true }] },
] as const;

export const AGGREGATOR_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export const ZERO_HANDLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

export const shortAddr = (a: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
