import { describe, expect, it } from "vitest";
import { isContractDeployed } from "../src/blockchain/contract.js";
import { provider } from "../src/blockchain/provider.js";

// isContractDeployed() exists specifically to catch the window right after
// `npm run dev` where the API is up but Hardhat hasn't finished (re)deploying
// yet — deployment.json points at an address with no code on the current
// chain. We can't safely simulate "no contract at all" without disrupting the
// shared Hardhat chain every other test in this suite relies on, but we can
// verify the two halves of the check directly: it correctly reports the real
// deployed contract as ready, and provider.getCode on a address with no code
// (the actual signal the function relies on) really does come back as "0x".
describe("isContractDeployed", () => {
  it("reports the real deployed contract as ready", async () => {
    expect(await isContractDeployed()).toBe(true);
  });

  it("returns empty code for an address with no contract, confirming the underlying signal", async () => {
    const code = await provider.getCode("0x000000000000000000000000000000000000dEaD");
    expect(code).toBe("0x");
  });
});
