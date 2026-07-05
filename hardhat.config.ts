import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY ?? "";
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";

if (!TEST_PRIVATE_KEY) {
  throw new Error("TEST_PRIVATE_KEY missing from .env");
}

const accounts = [
  TEST_PRIVATE_KEY.startsWith("0x") ? TEST_PRIVATE_KEY : `0x${TEST_PRIVATE_KEY}`,
];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: { bytecodeHash: "none" },
      optimizer: { enabled: true, runs: 800 },
      viaIR: true,
      evmVersion: "cancun",
    },
  },
  networks: {
    hardhat: { chainId: 31337 },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      chainId: 11155111,
      accounts,
    },
  },
  etherscan: {
    apiKey: { sepolia: ETHERSCAN_API_KEY },
    customChains: [
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          // Etherscan V2 multichain endpoint (V1 per-network endpoints are retired).
          apiURL: `https://api.etherscan.io/v2/api?chainid=11155111`,
          browserURL: "https://sepolia.etherscan.io",
        },
      },
    ],
  },
  sourcify: { enabled: false },
};

export default config;
