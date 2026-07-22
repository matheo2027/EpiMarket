import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { createAdmin, createBinaryMarket, createMultiMarket, registerUser, resetDb } from "./helpers.js";

describe("bet withdrawal", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("BINARY: refunds the stake in full and restores the pool", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("withdrawer");
    const market = await createBinaryMarket(admin.token);

    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 200 });
    expect(Number(bet.body.market.yesPool)).toBeGreaterThan(Number(market.yesPool));

    const withdraw = await request(app)
      .post(`/bets/${bet.body.bet.id}/withdraw`)
      .set("Authorization", `Bearer ${bettor.token}`);
    expect(withdraw.status).toBe(200);
    expect(Number(withdraw.body.bet.payout)).toBeCloseTo(200, 1);
    expect(withdraw.body.bet.withdrawnAt).toBeTypeOf("string");
    expect(Number(withdraw.body.market.yesPool)).toBeCloseTo(Number(market.yesPool), 1);

    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${bettor.token}`);
    expect(Number(me.body.user.walletBalance)).toBeCloseTo(1000, 1);
  });

  it("MULTI: refunds the stake in full and restores the option pool", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("multiwithdrawer");
    const market = await createMultiMarket(admin.token);
    const option = market.options[0];

    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, optionId: option.id, amount: 150 });

    const withdraw = await request(app)
      .post(`/bets/${bet.body.bet.id}/withdraw`)
      .set("Authorization", `Bearer ${bettor.token}`);
    expect(withdraw.status).toBe(200);
    expect(Number(withdraw.body.bet.payout)).toBeCloseTo(150, 1);

    const restoredOption = withdraw.body.market.options.find((o: { id: string }) => o.id === option.id);
    expect(Number(restoredOption.pool)).toBeCloseTo(Number(option.pool), 1);
  });

  it("rejects withdrawing within 5 hours of the market's close", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("lastminute");
    const market = await createBinaryMarket(admin.token, {
      endDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 50 });

    const res = await request(app)
      .post(`/bets/${bet.body.bet.id}/withdraw`)
      .set("Authorization", `Bearer ${bettor.token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/5 hours/i);
  });

  it("rejects withdrawing someone else's bet", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("owner3");
    const stranger = await registerUser("stranger3");
    const market = await createBinaryMarket(admin.token);

    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 50 });

    const res = await request(app)
      .post(`/bets/${bet.body.bet.id}/withdraw`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(res.status).toBe(403);
  });

  it("rejects withdrawing the same bet twice", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("doublewithdraw");
    const market = await createBinaryMarket(admin.token);

    const bet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.id, side: "YES", amount: 50 });

    await request(app).post(`/bets/${bet.body.bet.id}/withdraw`).set("Authorization", `Bearer ${bettor.token}`).expect(200);

    const second = await request(app)
      .post(`/bets/${bet.body.bet.id}/withdraw`)
      .set("Authorization", `Bearer ${bettor.token}`);
    expect(second.status).toBe(400);
  });

  it("rejects withdrawing after the market resolves, and excludes it from the payout", async () => {
    const admin = await createAdmin();
    const alice = await registerUser("alicewithdraw");
    const bob = await registerUser("bobwithdraw");
    const market = await createBinaryMarket(admin.token);

    const aliceBet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ marketId: market.id, side: "YES", amount: 100 });
    await request(app)
      .post(`/bets/${aliceBet.body.bet.id}/withdraw`)
      .set("Authorization", `Bearer ${alice.token}`)
      .expect(200);

    const bobBet = await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ marketId: market.id, side: "YES", amount: 200 });

    await request(app)
      .post(`/markets/${market.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ outcome: "YES" })
      .expect(200);

    // Bob is the only real backer left, so he gets the whole real pot.
    const bobAfter = await request(app).get(`/bets/${bobBet.body.bet.id}`).set("Authorization", `Bearer ${bob.token}`);
    expect(Number(bobAfter.body.bet.payout)).toBeCloseTo(200, 1);

    // Alice's refund from earlier must not have been overwritten by the resolve sync.
    const aliceAfter = await request(app)
      .get(`/bets/${aliceBet.body.bet.id}`)
      .set("Authorization", `Bearer ${alice.token}`);
    expect(Number(aliceAfter.body.bet.payout)).toBeCloseTo(100, 1);

    const tooLate = await request(app)
      .post(`/bets/${bobBet.body.bet.id}/withdraw`)
      .set("Authorization", `Bearer ${bob.token}`);
    expect(tooLate.status).toBe(400);
  });
});
