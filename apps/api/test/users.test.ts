import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { activeWindow, createAdmin, registerUser, resetDb, unique } from "./helpers.js";

describe("users (admin CRUD)", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("creates a user (with a funded wallet) and an admin (without one)", async () => {
    const admin = await createAdmin();
    const name = unique("created");

    const created = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: `${name}@test.epitech.eu`, username: name, password: "testpass123" });
    expect(created.status).toBe(201);
    expect(created.body.user.role).toBe("USER");
    expect(created.body.user.walletAddress).toBeTypeOf("string");
    expect(Number(created.body.user.walletBalance)).toBeGreaterThan(0);

    const adminName = unique("newadmin");
    const createdAdmin = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: `${adminName}@test.epitech.eu`, username: adminName, password: "testpass123", role: "ADMIN" });
    expect(createdAdmin.status).toBe(201);
    expect(createdAdmin.body.user.walletAddress).toBeNull();
  });

  it("rejects a duplicate email/username and requires admin", async () => {
    const admin = await createAdmin();
    const user = await registerUser("dupecheck");

    const denied = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ email: "someone@test.epitech.eu", username: unique("x"), password: "testpass123" });
    expect(denied.status).toBe(403);

    const dupe = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: user.user.email, username: unique("y"), password: "testpass123" });
    expect(dupe.status).toBe(409);
  });

  it("lets a user view themselves, blocks viewing a stranger, allows admin", async () => {
    const admin = await createAdmin();
    const alice = await registerUser("aliceview");
    const bob = await registerUser("bobview");

    const own = await request(app).get(`/users/${alice.user.id}`).set("Authorization", `Bearer ${alice.token}`);
    expect(own.status).toBe(200);

    const stranger = await request(app).get(`/users/${alice.user.id}`).set("Authorization", `Bearer ${bob.token}`);
    expect(stranger.status).toBe(403);

    const asAdmin = await request(app).get(`/users/${alice.user.id}`).set("Authorization", `Bearer ${admin.token}`);
    expect(asAdmin.status).toBe(200);
  });

  it("updates a user's username/email/role, rejects a duplicate", async () => {
    const admin = await createAdmin();
    const alice = await registerUser("aliceedit");
    const bob = await registerUser("bobedit");

    const renamed = await request(app)
      .patch(`/users/${alice.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ username: unique("renamed") });
    expect(renamed.status).toBe(200);

    const dupe = await request(app)
      .patch(`/users/${alice.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ email: bob.user.email });
    expect(dupe.status).toBe(409);
  });

  it("deletes a user with no bets, refuses to delete a user with bets or the admin's own account", async () => {
    const admin = await createAdmin();
    const bettor = await registerUser("deletetarget");
    const market = await request(app)
      .post("/markets")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        title: unique("Delete-Market"),
        description: "d",
        category: "OTHER",
        yesDescription: "yes",
        noDescription: "no",
        ...activeWindow(),
      });

    await request(app)
      .post("/bets")
      .set("Authorization", `Bearer ${bettor.token}`)
      .send({ marketId: market.body.market.id, side: "YES", amount: 10 });

    const deniedWithBets = await request(app)
      .delete(`/users/${bettor.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(deniedWithBets.status).toBe(400);

    const deniedSelf = await request(app)
      .delete(`/users/${admin.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(deniedSelf.status).toBe(400);

    const freshUser = await registerUser("nobets");
    const deleted = await request(app)
      .delete(`/users/${freshUser.user.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(deleted.status).toBe(204);
  });

  it("exposes admin-only global stats", async () => {
    const admin = await createAdmin();
    const user = await registerUser("statsuser");

    const denied = await request(app).get("/users/stats").set("Authorization", `Bearer ${user.token}`);
    expect(denied.status).toBe(403);

    const stats = await request(app).get("/users/stats").set("Authorization", `Bearer ${admin.token}`);
    expect(stats.status).toBe(200);
    expect(stats.body.stats.totalUsers).toBeGreaterThanOrEqual(2);
  });
});
