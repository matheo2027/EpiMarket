import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { createAdmin, createBinaryMarket, registerUser, resetDb } from "./helpers.js";

describe("leaderboard", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("only ranks users with at least one resolved bet, sorted by net P&L", async () => {
    const admin = await createAdmin();
    const winner = await registerUser("winner");
    const idle = await registerUser("idle");
    const market = await createBinaryMarket(admin.token);

    await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${winner.token}`)
      .send({ marketId: market.id, side: "YES", amount: 40 })
      .expect(201);

    await request(app)
      .post(`/markets/${market.id}/resolve`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ outcome: "YES" })
      .expect(200);

    const board = await request(app).get("/users/leaderboard");
    expect(board.status).toBe(200);

    const usernames = board.body.leaderboard.map((e: { username: string }) => e.username);
    expect(usernames).toContain(winner.user.username);
    expect(usernames).not.toContain(idle.user.username);

    const pnls = board.body.leaderboard.map((e: { netPnl: number }) => e.netPnl);
    expect([...pnls]).toEqual([...pnls].sort((a, b) => b - a));
  });
});
