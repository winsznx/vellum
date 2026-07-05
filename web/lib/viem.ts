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
