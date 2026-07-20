import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { activeWindow, createAdmin, createBinaryMarket, createMultiMarket, registerUser, resetDb, unique } from "./helpers.js";

describe("markets", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("rejects market creation from a non-admin, allows it for an admin", async () => {
    const user = await registerUser("nonadmin");
    const denied = await request(app)
      .post("/markets")
      .set("Authorization", `Bearer ${user.token}`)
      .send({
        title: "Should be rejected",
        description: "desc",
        category: "OTHER",
        yesDescription: "yes",
        noDescription: "no",
        ...activeWindow(),
      });
    expect(denied.status).toBe(403);

    const admin = await createAdmin();
    const market = await createBinaryMarket(admin.token);
    expect(market.status).toBe("OPEN");
    expect(market.type).toBe("BINARY");
    expect(market.yesPrice).toBeCloseTo(0.5, 5);
  });

  it("filters by search (case-insensitive) and sorts by volume", async () => {
    const admin = await createAdmin();
    const needle = unique("Bitcoin");
    await createBinaryMarket(admin.token, { title: `${needle} moons?` });
    await createBinaryMarket(admin.token, { title: "Unrelated market" });

    const found = await request(app).get(`/markets?search=${needle.toLowerCase()}`);
    expect(found.status).toBe(200);
    expect(found.body.markets).toHaveLength(1);
    expect(found.body.markets[0].title).toContain(needle);

    const sorted = await request(app).get("/markets?sort=volume");
    expect(sorted.status).toBe(200);
    const volumes = sorted.body.markets.map((m: { totalVolume: string }) => Number(m.totalVolume));
    expect([...volumes]).toEqual([...volumes].sort((a, b) => b - a));

    const badSort = await request(app).get("/markets?sort=bogus");
    expect(badSort.status).toBe(400);
  });

  it("full BINARY lifecycle: bet, resolve, payout", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("bettor");
    const market = await createBinaryMarket(admin.token);

    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 100 });
    expect(bet.status).toBe(201);
    expect(bet.body.bet.payout).toBeNull();
    expect(bet.body.market.yesPrice).toBeGreaterThan(0.5);

    const resolve = await request(app)
      .post(`/markets/${market.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ outcome: "YES" });
    expect(resolve.status).toBe(200);
    expect(resolve.body.market.status).toBe("RESOLVED");
    expect(resolve.body.market.resolvedOutcome).toBe("YES");

    const betAfter = await request(app).get(`/bets/${bet.body.bet.id}`).set("Authorization", `Bearer ${bettor.token}`);
    expect(betAfter.status).toBe(200);
    // Sole real bettor on the winning side gets back exactly what was staked
    // (only real money is redistributed, not the virtual seed liquidity).
    expect(Number(betAfter.body.bet.payout)).toBeCloseTo(100, 1);
  });

  it("full MULTI lifecycle: bet on one option, resolve, payout", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("multibettor");
    const market = await createMultiMarket(admin.token);
    const targetOption = market.options[1];

    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, optionId: targetOption.id, amount: 50 });
    expect(bet.status).toBe(201);
    expect(bet.body.bet.side).toBeNull();
    expect(bet.body.bet.optionId).toBe(targetOption.id);

    const resolve = await request(app)
      .post(`/markets/${market.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ optionId: targetOption.id });
    expect(resolve.status).toBe(200);
    expect(resolve.body.market.resolvedOptionId).toBe(targetOption.id);

    const betAfter = await request(app).get(`/bets/${bet.body.bet.id}`).set("Authorization", `Bearer ${bettor.token}`);
    expect(Number(betAfter.body.bet.payout)).toBeCloseTo(50, 1);
  });

  it("rejects betting on a market outside its active window", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("latebettor");
    const market = await createBinaryMarket(admin.token, {
      startDate: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      endDate: new Date(Date.now() - 86_400_000).toISOString(),
    });

    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 10 });
    expect(bet.status).toBe(400);
    expect(bet.body.error).toMatch(/betting period has ended/i);
  });
});
