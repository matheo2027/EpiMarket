import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { createAdmin, createBinaryMarket, registerUser, resetDb } from "./helpers.js";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET!;

describe("bets", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("rejects a bet larger than the user's wallet balance", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("poor");
    const market = await createBinaryMarket(admin.token);

    const res = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 1_000_000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient balance/i);
  });

  it("rejects an admin trying to place a bet", async () => {
    const admin = await createAdmin();
    const market = await createBinaryMarket(admin.token);

    const res = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ marketId: market.id, side: "YES", amount: 10 });

    expect(res.status).toBe(403);
  });

  it("rejects a bet with a missing or non-positive amount", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("zeroamount");
    const market = await createBinaryMarket(admin.token);

    const res = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 0 });

    expect(res.status).toBe(400);
  });

  it("only lets the bet's owner (or an admin) read it", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("owner");
    const stranger = await registerUser("stranger");
    const market = await createBinaryMarket(admin.token);

    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 10 });

    const asStranger = await request(app).get(`/bets/${bet.body.bet.id}`).set("Authorization", `Bearer ${stranger.token}`);
    expect(asStranger.status).toBe(403);

    const asAdmin = await request(app).get(`/bets/${bet.body.bet.id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(asAdmin.status).toBe(200);
  });

  it("GET /bets?marketId= only returns the caller's bets on that market", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("marketscoped");
    const marketA = await createBinaryMarket(admin.token);
    const marketB = await createBinaryMarket(admin.token);

    await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: marketA.id, side: "YES", amount: 10 })
      .expect(201);
    await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: marketB.id, side: "NO", amount: 20 })
      .expect(201);

    const res = await request(app).get(`/bets?marketId=${marketA.id}`).set("Authorization", `Bearer ${bettor.token}`);
    expect(res.status).toBe(200);
    expect(res.body.bets).toHaveLength(1);
    expect(res.body.bets[0].marketId).toBe(marketA.id);
  });

  it("requires the internal secret to read or mark the Discord bets feed", async () => {
    const missing = await request(app).get("/bets/unnotified");
    expect(missing.status).toBe(401);

    const wrong = await request(app).get("/bets/unnotified").set("X-Internal-Secret", "nope");
    expect(wrong.status).toBe(401);
  });

  it("feeds a newly placed bet once, then stops listing it once marked notified", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("feedbettor");
    const market = await createBinaryMarket(admin.token);

    const placed = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 15 });
    const betId = placed.body.bet.id;

    const feed = await request(app).get("/bets/unnotified").set("X-Internal-Secret", INTERNAL_SECRET);
    expect(feed.status).toBe(200);
    const entry = feed.body.placed.find((b: { id: string }) => b.id === betId);
    expect(entry).toBeDefined();
    expect(entry.user.username).toBe(bettor.user.username);
    expect(entry.market.title).toBe(market.title);
    expect(feed.body.withdrawn).toHaveLength(0);

    const marked = await request(app)
      .patch(`/bets/${betId}/notify`)
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ event: "placed" });
    expect(marked.status).toBe(200);

    const feedAfter = await request(app).get("/bets/unnotified").set("X-Internal-Secret", INTERNAL_SECRET);
    expect(feedAfter.body.placed.find((b: { id: string }) => b.id === betId)).toBeUndefined();
  });

  it("feeds a withdrawn bet separately from the placed feed", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("feedwithdrawer");
    const market = await createBinaryMarket(admin.token);

    const placed = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "NO", amount: 20 });
    const betId = placed.body.bet.id;

    await request(app)
      .patch(`/bets/${betId}/notify`)
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ event: "placed" });

    await request(app).post(`/bets/${betId}/withdraw`).set("Authorization", `Bearer ${bettor.token}`).expect(200);

    const feed = await request(app).get("/bets/unnotified").set("X-Internal-Secret", INTERNAL_SECRET);
    expect(feed.body.placed.find((b: { id: string }) => b.id === betId)).toBeUndefined();
    const withdrawnEntry = feed.body.withdrawn.find((b: { id: string }) => b.id === betId);
    expect(withdrawnEntry).toBeDefined();

    const marked = await request(app)
      .patch(`/bets/${betId}/notify`)
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ event: "withdrawn" });
    expect(marked.status).toBe(200);

    const feedAfter = await request(app).get("/bets/unnotified").set("X-Internal-Secret", INTERNAL_SECRET);
    expect(feedAfter.body.withdrawn.find((b: { id: string }) => b.id === betId)).toBeUndefined();
  });
});
