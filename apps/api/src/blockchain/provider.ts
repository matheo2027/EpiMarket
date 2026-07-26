import { ethers } from "ethers";

function getRpcUrl(): string {
  return process.env.HARDHAT_RPC_URL ?? "http://127.0.0.1:8545";
}

function getFunderPrivateKey(): string {
  const key = process.env.HARDHAT_FUNDER_PRIVATE_KEY;
  if (!key) throw new Error("HARDHAT_FUNDER_PRIVATE_KEY is not set");
  return key;
}

export const provider = new ethers.JsonRpcProvider(getRpcUrl());

let funderWallet: ethers.Wallet | undefined;

export function getFunderWallet(): ethers.Wallet {
  if (!funderWallet) {
    funderWallet = new ethers.Wallet(getFunderPrivateKey(), provider);
  }
  return funderWallet;
}

const addressNonces = new Map<string, number>();
const addressQueues = new Map<string, Promise<void>>();

let lastKnownContractAddress: string | undefined;

/**
 * Hardhat resets every account's nonce to 0 when its container restarts and
 * redeploys the contract to a new address (apps/blockchain/README.md#limites-assumées-du-poc),
 * but this process's in-memory nonce cache survives that restart — the next
 * send for any address would use its old, now-too-high nonce and get
 * rejected ("Nonce too low"), which callers like `provisionNewWallet` catch
 * and log rather than surface, so it can silently leave a user under-funded.
 * Called from contract.ts#getDeployment(), the one choke point every
 * contract-touching call already goes through, so a redeploy is caught
 * before the next send rather than only after it fails once.
 */
export function noteContractAddress(address: string): void {
  if (lastKnownContractAddress !== undefined && lastKnownContractAddress !== address) {
    addressNonces.clear();
  }
  lastKnownContractAddress = address;
}

/**
 * Serializes every transaction sent from `address` and tracks its nonce
 * locally instead of trusting a fresh `getTransactionCount()` at send time —
 * needed because a wallet sending two transactions shortly apart (e.g. place
 * a bet, then withdraw it) can otherwise hit a "nonce has already been used"
 * revert even though the RPC's own count is correct by then.
 */
export function runAsSender<T>(address: string, send: (nonce: number) => Promise<T>): Promise<T> {
  const queue = addressQueues.get(address) ?? Promise.resolve();
  const result = queue.then(async () => {
    let nonce = addressNonces.get(address);
    if (nonce === undefined) {
      nonce = await provider.getTransactionCount(address, "latest");
    }
    try {
      const value = await send(nonce);
      addressNonces.set(address, nonce + 1);
      return value;
    } catch (err) {
      addressNonces.delete(address);
      throw err;
    }
  });
  addressQueues.set(
    address,
    result.then(
      () => undefined,
      () => undefined,
    ),
  );
  return result;
}

export function runAsOwner<T>(send: (nonce: number) => Promise<T>): Promise<T> {
  return runAsSender(getFunderWallet().address, send);
}
