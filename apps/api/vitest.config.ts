import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Tests hit the real Hardhat node with the shared owner/funder account;
    // running files in parallel would race its nonce across separate worker
    // processes, so everything stays sequential in one process.
    fileParallelism: false,
  },
});
