import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { createAdmin, createBinaryMarket, registerUser, resetDb } from "./helpers.js";

describe("favorites", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("adds, lists, and removes a favorite", async () => {
    const admin = await createAdmin();
    const user = await registerUser("favuser");
    const market = await createBinaryMarket(admin.token);

    const add = await request(app)
      .post(`/markets/${market.id}/favorite`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(add.status).toBe(204);

    const list = await request(app).get("/users/me/favorites").set("Authorization", `Bearer ${user.token}`);
    expect(list.status).toBe(200);
    expect(list.body.marketIds).toEqual([market.id]);

    // Favoriting twice is idempotent, not a duplicate/error.
    const addAgain = await request(app)
      .post(`/markets/${market.id}/favorite`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(addAgain.status).toBe(204);
    const listAfterDupe = await request(app).get("/users/me/favorites").set("Authorization", `Bearer ${user.token}`);
    expect(listAfterDupe.body.marketIds).toEqual([market.id]);

    const remove = await request(app)
      .delete(`/markets/${market.id}/favorite`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(remove.status).toBe(204);

    const listAfterRemove = await request(app).get("/users/me/favorites").set("Authorization", `Bearer ${user.token}`);
    expect(listAfterRemove.body.marketIds).toEqual([]);
  });

  it("requires auth to favorite a market", async () => {
    const admin = await createAdmin();
    const market = await createBinaryMarket(admin.token);
    const res = await request(app).post(`/markets/${market.id}/favorite`);
    expect(res.status).toBe(401);
  });

  it("keeps each user's favorites separate", async () => {
    const admin = await createAdmin();
    const alice = await registerUser("alicefav");
    const bob = await registerUser("bobfav");
    const market = await createBinaryMarket(admin.token);

    await request(app).post(`/markets/${market.id}/favorite`).set("Authorization", `Bearer ${alice.token}`).expect(204);

    const aliceList = await request(app).get("/users/me/favorites").set("Authorization", `Bearer ${alice.token}`);
    expect(aliceList.body.marketIds).toEqual([market.id]);

    const bobList = await request(app).get("/users/me/favorites").set("Authorization", `Bearer ${bob.token}`);
    expect(bobList.body.marketIds).toEqual([]);
  });
});
