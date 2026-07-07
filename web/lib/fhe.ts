"use client";

// FHE reveal client — the product's climax interaction (D0.5).
// Lazy-loads the Zama relayer SDK in the browser, builds the EIP-712 userDecrypt flow,
// returns cleartext ONLY to the authorized holder. No fake values: a sealed handle stays
// sealed until the holder signs (design law #6).

import type { BrowserProvider, TypedDataDomain, TypedDataField } from "ethers";

type EIP712 = {
  domain: TypedDataDomain;
  types: Record<string, TypedDataField[]>;
  message: Record<string, unknown>;
};

type EncryptedInputBuilder = {
  add64: (value: bigint) => EncryptedInputBuilder;
  encrypt: () => Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
};
type PublicDecryptResults = { clearValues: Record<string, bigint | boolean | string>; decryptionProof: `0x${string}` };

type FhevmInstance = {
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (publicKey: string, contracts: string[], start: number, days: number) => EIP712;
  userDecrypt: (
    handles: { handle: string; contractAddress: string }[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contracts: string[],
    user: string,
    start: number,
    days: number,
  ) => Promise<Record<string, bigint | boolean | string>>;
  createEncryptedInput: (contractAddress: string, userAddress: string) => EncryptedInputBuilder;
  publicDecrypt: (handles: string[]) => Promise<PublicDecryptResults>;
};

let _instance: FhevmInstance | null = null;

async function getInstance(): Promise<FhevmInstance> {
  if (_instance) return _instance;
  // dynamic import: relayer SDK is browser/WASM-heavy, keep it out of the server bundle
  const sdk = await import("@zama-fhe/relayer-sdk/web");
  await sdk.initSDK();
  // SepoliaConfig omits `network`; supply a Sepolia RPC URL string. The SDK uses it to read chain
  // state (ACL/contract) — wallet signing happens separately on the ethers signer, so a raw RPC is
  // the robust choice (extracting an EIP-1193 provider across wallets is unreliable). Cast at this
  // single boundary since the SDK's config type is internal and we model FhevmInstance structurally.
  const rpc = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
  const config = { ...sdk.SepoliaConfig, network: rpc } as Parameters<typeof sdk.createInstance>[0];
  _instance = (await sdk.createInstance(config)) as unknown as FhevmInstance;
  return _instance;
}

export type RevealResult = { cleartext: bigint; handle: string };

/**
 * Reveal a single euint64 handle to its authorized holder via the full EIP-712 userDecrypt flow.
 * Throws if the connected wallet is not authorized for the handle (the seal holds).
 */
export async function revealHandle(args: {
  handle: string;
  contractAddress: string;
  provider: BrowserProvider;
  durationDays?: number;
}): Promise<RevealResult> {
  const { handle, contractAddress, provider } = args;
  const durationDays = args.durationDays ?? 10;

  const instance = await getInstance();
  const signer = await provider.getSigner();
  const userAddress = await signer.getAddress();

  const keypair = instance.generateKeypair();
  const startTimestamp = Math.floor(Date.now() / 1000);
  const contracts = [contractAddress];

  const eip712 = instance.createEIP712(keypair.publicKey, contracts, startTimestamp, durationDays);
  const signature = await signer.signTypedData(
    eip712.domain,
    { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
    eip712.message,
  );

  const result = await instance.userDecrypt(
    [{ handle, contractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signature.replace(/^0x/, ""),
    contracts,
    userAddress,
    startTimestamp,
    durationDays,
  );

  return { handle, cleartext: result[handle] as bigint };
}

export type UnwrapPhase = "encrypting" | "requesting" | "resolving" | "decrypting" | "finalizing" | "done";
export type UnwrapProgress = { phase: UnwrapPhase; tx?: string };

type WrapperContract = {
  unwrap: (from: string, to: string, encryptedAmount: string, inputProof: string) => Promise<{ hash: string; wait: () => Promise<{ logs: { topics: readonly string[]; data: string }[] }> }>;
  unwrapAmount: (id: string) => Promise<string>;
  finalizeUnwrap: (id: string, cleartext: bigint, proof: string) => Promise<{ hash: string; wait: () => Promise<unknown> }>;
};

const WRAPPER_UNWRAP_ABI = [
  "function unwrap(address,address,bytes32,bytes) returns (bytes32)",
  "function unwrapAmount(bytes32) view returns (bytes32)",
  "function finalizeUnwrap(bytes32,uint64,bytes)",
];

/**
 * Unwrap a confidential ERC-7984 balance back to the public underlying via the two-step
 * confidential→public flow: encrypt the amount, submit unwrap, public-decrypt the amount with a
 * KMS proof, then finalize. Mirrors the proven c3-wrap round-trip. Real transactions throughout.
 */
export async function unwrapConfidential(args: {
  wrapper: string;
  amount: bigint;
  provider: BrowserProvider;
  onProgress?: (p: UnwrapProgress) => void;
}): Promise<{ requestTx: string; finalizeTx: string; amount: bigint }> {
  const { wrapper, amount, provider, onProgress } = args;
  const instance = await getInstance();
  const signer = await provider.getSigner();
  const user = await signer.getAddress();

  onProgress?.({ phase: "encrypting" });
  const enc = await instance.createEncryptedInput(wrapper, user).add64(amount).encrypt();

  const { Contract, hexlify, Interface } = await import("ethers");
  const encHandle = hexlify(enc.handles[0]);
  const inputProof = hexlify(enc.inputProof);
  const c = new Contract(wrapper, WRAPPER_UNWRAP_ABI, signer) as unknown as WrapperContract;

  onProgress?.({ phase: "requesting" });
  const utx = await c.unwrap(user, user, encHandle, inputProof);
  const receipt = await utx.wait();
  onProgress?.({ phase: "requesting", tx: utx.hash });

  // Decode the request id + internal encrypted-amount handle from the UnwrapRequested event.
  // requestId is an indexed topic; `amount` is the on-chain, publicly-decryptable ciphertext handle
  // (heuristic log-probing grabbed non-handle words → the earlier "Unknown FheType" failures).
  onProgress?.({ phase: "resolving" });
  const iface = new Interface(["event UnwrapRequested(address indexed receiver, bytes32 indexed unwrapRequestId, bytes32 amount)"]);
  let requestId = "";
  let amountHandle = "";
  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
      if (parsed && parsed.name === "UnwrapRequested") {
        const a = parsed.args as unknown as { unwrapRequestId: string; amount: string };
        requestId = a.unwrapRequestId;
        amountHandle = a.amount;
        break;
      }
    } catch {
      /* not the UnwrapRequested event */
    }
  }
  if (!requestId || !amountHandle) throw new Error("UnwrapRequested event not found in the unwrap transaction.");

  onProgress?.({ phase: "decrypting" });
  let pd: PublicDecryptResults;
  try {
    pd = await instance.publicDecrypt([amountHandle]);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    throw new Error(`public-decrypt failed · requestId=${requestId} · amountHandle=${amountHandle} :: ${m}`);
  }
  const raw = pd.clearValues[amountHandle] ?? Object.values(pd.clearValues)[0];
  const cleartext = BigInt(raw);

  onProgress?.({ phase: "finalizing" });
  const ftx = await c.finalizeUnwrap(requestId, cleartext, pd.decryptionProof);
  await ftx.wait();
  onProgress?.({ phase: "done", tx: ftx.hash });

  return { requestTx: utx.hash, finalizeTx: ftx.hash, amount: cleartext };
}
