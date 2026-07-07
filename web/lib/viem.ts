import { createPublicClient, http, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { SEPOLIA_RPC_URL } from "./vellum";

let _client: PublicClient | null = null;

export function publicClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({ chain: sepolia, transport: http(SEPOLIA_RPC_URL) });
  }
  return _client;
}

// The primary RPC (QuickNode free tier) caps eth_getLogs to a 5-block range; drpc allows up to
// 10k. Event reads (Activity) use this client with chunked windows; state reads keep publicClient.
const LOGS_RPC_URL = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://sepolia.drpc.org";
let _logsClient: PublicClient | null = null;

export function logsClient(): PublicClient {
  if (!_logsClient) {
    _logsClient = createPublicClient({ chain: sepolia, transport: http(LOGS_RPC_URL) });
  }
  return _logsClient;
}
