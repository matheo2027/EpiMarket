import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { activeWindow, createAdmin, createBinaryMarket, createMultiMarket, registerUser, resetDb, unique } from "./helpers.js";

// Diagnostics detects a DB<->chain mismatch. The only realistic way to produce
// one in a test is to write directly to Postgres, bypassing the routes that
// normally keep both in sync (mirrors how a real desync happens: the chain
// state gets lost — e.g. a Hardhat restart — while Postgres keeps its rows).
describe("diagnostics", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("requires admin", async () => {
    const user = await registerUser("diaguser");
    const res = await request(app).get("/diagnostics").set("Authorization", `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });

  it("detects a BINARY market missing on-chain and resyncs it", async () => {
    const admin = await createAdmin();
    const window = activeWindow();
    const ghostMarket = await prisma.market.create({
      data: {
        title: unique("Ghost-Binary"),
        description: "d",
        category: "OTHER",
        yesDescription: "yes",
        noDescription: "no",
        startDate: new Date(window.startDate),
        endDate: new Date(window.endDate),
      },
    });

    const report = await request(app).get("/diagnostics").set("Authorization", `Bearer ${admin.token}`);
    expect(report.status).toBe(200);
    expect(report.body.unsyncedMarkets.map((m: { id: string }) => m.id)).toContain(ghostMarket.id);

    const resync = await request(app)
      .post(`/diagnostics/resync-market/${ghostMarket.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(resync.status).toBe(200);
    expect(resync.body.ok).toBe(true);

    const reportAfter = await request(app).get("/diagnostics").set("Authorization", `Bearer ${admin.token}`);
    expect(reportAfter.body.unsyncedMarkets.map((m: { id: string }) => m.id)).not.toContain(ghostMarket.id);

    // Now that it exists on-chain, resyncing again is rejected instead of double-creating it.
    const resyncAgain = await request(app)
      .post(`/diagnostics/resync-market/${ghostMarket.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(resyncAgain.status).toBe(400);
  });

  it("detects a MULTI market missing on-chain and resyncs it", async () => {
    const admin = await createAdmin();
    const window = activeWindow();
    const ghostMarket = await prisma.market.create({
      data: {
        title: unique("Ghost-Multi"),
        description: "d",
        type: "MULTI",
        category: "SPORTS",
        startDate: new Date(window.startDate),
        endDate: new Date(window.endDate),
        options: { create: [{ label: "A", sortOrder: 0 }, { label: "B", sortOrder: 1 }, { label: "C", sortOrder: 2 }] },
      },
    });

    const report = await request(app).get("/diagnostics").set("Authorization", `Bearer ${admin.token}`);
    expect(report.body.unsyncedMarkets.map((m: { id: string }) => m.id)).toContain(ghostMarket.id);

    const resync = await request(app)
      .post(`/diagnostics/resync-market/${ghostMarket.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(resync.status).toBe(200);

    const reportAfter = await request(app).get("/diagnostics").set("Authorization", `Bearer ${admin.token}`);
    expect(reportAfter.body.unsyncedMarkets.map((m: { id: string }) => m.id)).not.toContain(ghostMarket.id);
  });

  it("detects a resolved market with a bet missing its payout", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("stuckbettor");
    const market = await createBinaryMarket(admin.token);

    await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 10 });

    // Simulate the chain having resolved without Postgres catching up: flip
    // the market to RESOLVED directly, leaving the bet's payout untouched.
    await prisma.market.update({ where: { id: market.id }, data: { status: "RESOLVED", resolvedOutcome: "YES" } });

    const report = await request(app).get("/diagnostics").set("Authorization", `Bearer ${admin.token}`);
    expect(report.body.stuckBets.some((b: { marketId: string }) => b.marketId === market.id)).toBe(true);
  });

  it("detects a wallet balance drift and resyncs it", async () => {
    const admin = await createAdmin();
    const user = await registerUser("driftuser");
    const realBalance = Number(user.user.walletBalance);

    await prisma.user.update({ where: { id: user.user.id }, data: { walletBalance: realBalance - 500 } });

    const report = await request(app).get("/diagnostics").set("Authorization", `Bearer ${admin.token}`);
    const drift = report.body.balanceDrift.find((d: { id: string }) => d.id === user.user.id);
    expect(drift).toBeDefined();
    expect(drift.dbBalance).toBeCloseTo(realBalance - 500, 1);
    expect(drift.onChainBalance).toBeCloseTo(realBalance, 1);

    const resync = await request(app)
      .post(`/diagnostics/resync-balance/${user.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(resync.status).toBe(200);
    expect(Number(resync.body.walletBalance)).toBeCloseTo(realBalance, 1);

    const reportAfter = await request(app).get("/diagnostics").set("Authorization", `Bearer ${admin.token}`);
    expect(reportAfter.body.balanceDrift.find((d: { id: string }) => d.id === user.user.id)).toBeUndefined();
  });

  it("resync-all fixes an unsynced market, a stuck bet, and a balance drift in one call", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("resyncallbettor");
    const window = activeWindow();

    // 1. A market that only exists in Postgres (chain wiped by a Hardhat restart).
    const ghostMarket = await prisma.market.create({
      data: {
        title: unique("Ghost-ResyncAll"),
        description: "d",
        category: "OTHER",
        yesDescription: "yes",
        noDescription: "no",
        startDate: new Date(window.startDate),
        endDate: new Date(window.endDate),
      },
    });

    // 2. A resolved market with a bet whose payout was never computed.
    const stuckMarket = await createBinaryMarket(admin.token);
    await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: stuckMarket.id, side: "YES", amount: 10 });
    await prisma.market.update({ where: { id: stuckMarket.id }, data: { status: "RESOLVED", resolvedOutcome: "YES" } });

    // 3. A wallet balance that no longer matches the chain.
    const realBalance = Number(bettor.user.walletBalance);
    await prisma.user.update({ where: { id: bettor.user.id }, data: { walletBalance: realBalance - 500 } });

    const before = await request(app).get("/diagnostics").set("Authorization", `Bearer ${admin.token}`);
    expect(before.body.unsyncedMarkets.map((m: { id: string }) => m.id)).toContain(ghostMarket.id);
    expect(before.body.stuckBets.some((b: { marketId: string }) => b.marketId === stuckMarket.id)).toBe(true);
    expect(before.body.balanceDrift.some((d: { id: string }) => d.id === bettor.user.id)).toBe(true);

    const resyncAll = await request(app).post("/diagnostics/resync-all").set("Authorization", `Bearer ${admin.token}`);
    expect(resyncAll.status).toBe(200);
    expect(resyncAll.body.markets.recreated).toBeGreaterThanOrEqual(1);
    expect(resyncAll.body.markets.failed).toHaveLength(0);
    expect(resyncAll.body.bets.resynced).toBeGreaterThanOrEqual(1);
    expect(resyncAll.body.bets.failed).toHaveLength(0);
    expect(resyncAll.body.balances.resynced).toBeGreaterThanOrEqual(1);
    expect(resyncAll.body.balances.failed).toHaveLength(0);

    const after = await request(app).get("/diagnostics").set("Authorization", `Bearer ${admin.token}`);
    expect(after.body.unsyncedMarkets.map((m: { id: string }) => m.id)).not.toContain(ghostMarket.id);
    expect(after.body.stuckBets.some((b: { marketId: string }) => b.marketId === stuckMarket.id)).toBe(false);
    expect(after.body.balanceDrift.some((d: { id: string }) => d.id === bettor.user.id)).toBe(false);
  });

  it("resync-all is a no-op that reports zero actions when nothing is desynced", async () => {
    const admin = await createAdmin();
    const resyncAll = await request(app).post("/diagnostics/resync-all").set("Authorization", `Bearer ${admin.token}`);
    expect(resyncAll.status).toBe(200);
    expect(resyncAll.body).toEqual({
      markets: { recreated: 0, failed: [] },
      bets: { resynced: 0, failed: [] },
      balances: { resynced: 0, failed: [] },
    });
  });
});
