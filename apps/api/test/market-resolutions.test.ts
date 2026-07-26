import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { createAdmin, createBinaryMarket, createMultiMarket, registerUser, resetDb } from "./helpers.js";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET_RESOLUTIONS!;

describe("market resolution Discord feed", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("requires the internal secret to read or mark the resolutions feed", async () => {
    const missing = await request(app).get("/markets/unnotified-resolutions");
    expect(missing.status).toBe(401);

    const wrong = await request(app).get("/markets/unnotified-resolutions").set("X-Internal-Secret", "nope");
    expect(wrong.status).toBe(401);
  });

  it("rejects the bets bot's secret on the resolutions feed — each bot's secret only unlocks its own routes", async () => {
    const betsSecret = process.env.INTERNAL_API_SECRET_BETS!;
    const crossSecret = await request(app)
      .get("/markets/unnotified-resolutions")
      .set("X-Internal-Secret", betsSecret);
    expect(crossSecret.status).toBe(401);
  });

  it("feeds a resolved BINARY market once, then stops listing it once marked notified", async () => {
    const admin = await createAdmin();
    const market = await createBinaryMarket(admin.token);

    const beforeResolve = await request(app)
      .get("/markets/unnotified-resolutions")
      .set("X-Internal-Secret", INTERNAL_SECRET);
    expect(beforeResolve.body.markets.find((m: { id: string }) => m.id === market.id)).toBeUndefined();

    await request(app)
      .post(`/markets/${market.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ outcome: "YES" })
      .expect(200);

    const feed = await request(app).get("/markets/unnotified-resolutions").set("X-Internal-Secret", INTERNAL_SECRET);
    expect(feed.status).toBe(200);
    const entry = feed.body.markets.find((m: { id: string }) => m.id === market.id);
    expect(entry).toBeDefined();
    expect(entry.resolvedOutcome).toBe("YES");

    const marked = await request(app)
      .patch(`/markets/${market.id}/notify-resolution`)
      .set("X-Internal-Secret", INTERNAL_SECRET);
    expect(marked.status).toBe(204);

    const feedAfter = await request(app)
      .get("/markets/unnotified-resolutions")
      .set("X-Internal-Secret", INTERNAL_SECRET);
    expect(feedAfter.body.markets.find((m: { id: string }) => m.id === market.id)).toBeUndefined();
  });

  it("feeds a resolved MULTI market with the winning option included", async () => {
    const admin = await createAdmin();
    const market = await createMultiMarket(admin.token);
    const targetOption = market.options[2];

    await request(app)
      .post(`/markets/${market.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ optionId: targetOption.id })
      .expect(200);

    const feed = await request(app).get("/markets/unnotified-resolutions").set("X-Internal-Secret", INTERNAL_SECRET);
    const entry = feed.body.markets.find((m: { id: string }) => m.id === market.id);
    expect(entry).toBeDefined();
    expect(entry.resolvedOptionId).toBe(targetOption.id);
    expect(entry.options.find((o: { id: string }) => o.id === targetOption.id)).toBeDefined();
  });

  it("does not re-announce a market on a resync retry (Postgres-only desync after on-chain resolution)", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("resyncbettor");
    const market = await createBinaryMarket(admin.token);
    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 10 })
      .expect(201);

    await request(app)
      .post(`/markets/${market.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ outcome: "YES" })
      .expect(200);

    await request(app)
      .patch(`/markets/${market.id}/notify-resolution`)
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .expect(204);

    // Simulate a partial failure (resolved on-chain, but payout sync to
    // Postgres never completed) by clearing the payout directly, bypassing
    // the route — same technique as the diagnostics tests (test/diagnostics.test.ts).
    // This is the only way to legitimately reach the resync branch in
    // POST /markets/:id/resolve, which must not create a second, duplicate
    // notification (the (eventType, entityId) unique constraint would reject
    // it if it tried).
    await prisma.bet.update({ where: { id: bet.body.bet.id }, data: { payout: null } });

    await request(app)
      .post(`/markets/${market.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ outcome: "YES" })
      .expect(200);

    const feed = await request(app).get("/markets/unnotified-resolutions").set("X-Internal-Secret", INTERNAL_SECRET);
    expect(feed.body.markets.find((m: { id: string }) => m.id === market.id)).toBeUndefined();
  });
});
