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
};

let _instance: FhevmInstance | null = null;

async function getInstance(eip1193: unknown): Promise<FhevmInstance> {
  if (_instance) return _instance;
  // dynamic import: relayer SDK is browser/WASM-heavy, keep it out of the server bundle
  const sdk = await import("@zama-fhe/relayer-sdk/web");
  await sdk.initSDK();
  // SepoliaConfig omits only `network`; supply the EIP-1193 provider. Cast at this single
  // boundary since the SDK's exact config type is internal and we model FhevmInstance structurally.
  const config = { ...sdk.SepoliaConfig, network: eip1193 } as Parameters<typeof sdk.createInstance>[0];
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

  const eip1193 = (provider as unknown as { provider?: unknown }).provider ?? (window as unknown as { ethereum?: unknown }).ethereum;
  const instance = await getInstance(eip1193);

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
