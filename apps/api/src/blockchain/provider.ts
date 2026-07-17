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

let ownerNonce: number | undefined;
let ownerQueue: Promise<void> = Promise.resolve();

export function runAsOwner<T>(send: (nonce: number) => Promise<T>): Promise<T> {
  const result = ownerQueue.then(async () => {
    if (ownerNonce === undefined) {
      ownerNonce = await provider.getTransactionCount(getFunderWallet().address, "latest");
    }
    const nonce = ownerNonce;
    try {
      const value = await send(nonce);
      ownerNonce = nonce + 1;
      return value;
    } catch (err) {
      ownerNonce = undefined;
      throw err;
    }
  });
  ownerQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
