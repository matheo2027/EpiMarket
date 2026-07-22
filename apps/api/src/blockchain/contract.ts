import { readFileSync } from "node:fs";
import path from "node:path";
import { ethers } from "ethers";
import type { User } from "@prisma/client";
import { provider, getFunderWallet, runAsOwner } from "./provider.js";
import { decryptPrivateKey, fundWallet } from "./wallet.js";
import { fromChainAmount, toChainAmount } from "./units.js";
import { prisma } from "../prisma.js";

const INITIAL_TOKEN_BALANCE = 1000;

const OUTCOME_YES = 1;
const OUTCOME_NO = 2;

export function sideToOutcome(side: "YES" | "NO"): number {
  return side === "YES" ? OUTCOME_YES : OUTCOME_NO;
}

type Deployment = { address: string; abi: ethers.InterfaceAbi };

let deployment: Deployment | undefined;

function getDeployment(): Deployment {
  if (!deployment) {
    const filePath = path.join(__dirname, "deployment.json");
    try {
      deployment = JSON.parse(readFileSync(filePath, "utf8"));
    } catch {
      throw new Error(
        `Could not read ${filePath} - has "npm run deploy:localhost" (or the hardhat docker service) run yet?`,
      );
    }
  }
  return deployment!;
}

export function getReadOnlyContract(): ethers.Contract {
  const { address, abi } = getDeployment();
  return new ethers.Contract(address, abi, provider);
}

export function getOwnerContract(): ethers.Contract {
  const { address, abi } = getDeployment();
  return new ethers.Contract(address, abi, getFunderWallet());
}

export function getUserContract(user: Pick<User, "encryptedPrivateKey">): ethers.Contract {
  if (!user.encryptedPrivateKey) {
    throw new Error("User has no custodial wallet");
  }
  const { address, abi } = getDeployment();
  const wallet = new ethers.Wallet(decryptPrivateKey(user.encryptedPrivateKey), provider);
  return new ethers.Contract(address, abi, wallet);
}

export async function getOnChainBalance(address: string): Promise<number> {
  const balance: bigint = await getReadOnlyContract().balanceOf(address);
  return fromChainAmount(balance);
}

export async function syncUserBalance(userId: string, address: string): Promise<number> {
  const walletBalance = await getOnChainBalance(address);
  await prisma.user.update({ where: { id: userId }, data: { walletBalance } });
  return walletBalance;
}

export async function provisionNewWallet(userId: string, address: string): Promise<void> {
  try {
    await fundWallet(address);
    const tx = await runAsOwner((nonce) =>
      getOwnerContract().mint(address, toChainAmount(INITIAL_TOKEN_BALANCE), { nonce }),
    );
    await tx.wait();
    await syncUserBalance(userId, address);
  } catch (err) {
    console.warn(`Could not provision wallet ${address} for user ${userId}:`, (err as Error).message);
  }
}

/**
 * Reads the `index` a bet landed at on-chain straight out of the transaction
 * receipt's `BetPlaced`/`MultiBetPlaced` event, rather than assuming it from
 * `getBetCount()` timing (which can race under concurrent bets on the same
 * market) — needed so a later withdrawal can target the exact right bet.
 */
export function readPlacedBetIndex(receipt: ethers.ContractTransactionReceipt, eventName: string): number {
  for (const log of receipt.logs) {
    if ("fragment" in log && (log as ethers.EventLog).fragment?.name === eventName) {
      return Number((log as ethers.EventLog).args.index);
    }
  }
  throw new Error(`${eventName} event not found in transaction receipt`);
}

export function revertReason(err: unknown): string | undefined {
  const e = err as { reason?: string; shortMessage?: string };
  return e?.reason ?? e?.shortMessage;
}

const TRANSIENT_ERROR_CODES = new Set([
  "NETWORK_ERROR",
  "SERVER_ERROR",
  "TIMEOUT",
  "ECONNREFUSED",
  "ECONNRESET",
]);

/**
 * True when `err` looks like the Hardhat RPC node not being reachable yet — the
 * common case being a `docker compose up` where Postgres/the API come up before
 * Hardhat has finished booting and deploying the contract. This is transient and
 * usually resolves itself within a few seconds, so callers can surface it as
 * "retry shortly" rather than a hard failure.
 */
export function isBlockchainUnavailable(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code && TRANSIENT_ERROR_CODES.has(e.code)) return true;
  return /detect network|could not detect network|econnrefused|econnreset|socket hang up/i.test(e?.message ?? "");
}
