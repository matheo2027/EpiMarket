import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { ethers } from "ethers";
import { getFunderWallet, runAsOwner } from "./provider.js";

const FUNDING_AMOUNT = ethers.parseEther("1");

function getEncryptionKey(): Buffer {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key) throw new Error("WALLET_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) throw new Error("WALLET_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function generateCustodialWallet(): { address: string; privateKey: string } {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, privateKey: wallet.privateKey };
}

export function encryptPrivateKey(privateKey: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(privateKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptPrivateKey(encrypted: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encrypted.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Malformed encrypted private key");
  }
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export async function fundWallet(address: string): Promise<void> {
  const tx = await runAsOwner((nonce) =>
    getFunderWallet().sendTransaction({ to: address, value: FUNDING_AMOUNT, nonce }),
  );
  await tx.wait();
}
