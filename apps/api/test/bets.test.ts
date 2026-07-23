import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { createAdmin, createBinaryMarket, registerUser, resetDb } from "./helpers.js";

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
});
