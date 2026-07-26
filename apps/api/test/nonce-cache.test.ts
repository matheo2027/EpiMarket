import { ethers } from "ethers";
import { afterAll, describe, expect, it } from "vitest";
import { isContractDeployed } from "../src/blockchain/contract.js";
import { noteContractAddress, runAsSender } from "../src/blockchain/provider.js";

// Regression test for the Hardhat-restart nonce desync documented in
// apps/blockchain/README.md#limites-assumées-du-poc: this process's in-memory
// nonce cache (provider.ts) must not survive a contract redeploy, or the next
// send for any address reuses a nonce the fresh chain has never heard of and
// gets rejected ("Nonce too low" — see NOTES_ROADMAP.md). `noteContractAddress`
// guards against that; contract.ts#getDeployment() calls it on every
// contract-touching call, so it's exercised here directly rather than
// through a full HTTP round-trip.
//
// Freshly generated wallets (never sent a real transaction) stand in for
// "sender" addresses, and plain opaque strings stand in for "contract
// address" — noteContractAddress only ever compares them with `!==`, it
// never sends them to the RPC, so they don't need to be valid on-chain
// addresses. This avoids mocking the chain or disturbing the shared Hardhat
// state the rest of the suite relies on.
describe("nonce cache reset on contract redeploy", () => {
  afterAll(async () => {
    // Restore the tracked address to the real deployment so later test files
    // in this process don't pay for an unnecessary extra cache-clear.
    await isContractDeployed();
  });

  it("keeps incrementing the cached nonce across sends while the contract address is unchanged", async () => {
    const address = ethers.Wallet.createRandom().address;

    noteContractAddress("fake-deployment-1");
    const first = await runAsSender(address, async (nonce) => nonce);
    noteContractAddress("fake-deployment-1"); // same address reported again — must be a no-op
    const second = await runAsSender(address, async (nonce) => nonce);

    expect(second).toBe(first + 1);
  });

  it("clears every cached nonce once the contract address changes", async () => {
    const address = ethers.Wallet.createRandom().address;

    noteContractAddress("fake-deployment-2");
    const before = await runAsSender(address, async (nonce) => nonce);
    expect(before).toBe(0); // brand new address, never sent a transaction

    noteContractAddress("fake-deployment-3"); // simulates Hardhat redeploying to a new address
    const afterRedeploy = await runAsSender(address, async (nonce) => nonce);

    // Cache cleared → falls back to a fresh on-chain read for this same
    // never-used address, i.e. 0 again — not `before + 1`, which is what a
    // stale cache surviving the "redeploy" would have produced.
    expect(afterRedeploy).toBe(0);
  });
});
