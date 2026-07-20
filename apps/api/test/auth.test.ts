import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { resetDb, unique } from "./helpers.js";

describe("auth", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("registers a new user with a funded wallet and a token", async () => {
    const name = unique("alice");
    const res = await request(app)
      .post("/auth/register")
      .send({ email: `${name}@test.epitech.eu`, username: name, password: "testpass123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeTypeOf("string");
    expect(res.body.user.role).toBe("USER");
    expect(res.body.user.walletAddress).toBeTypeOf("string");
    expect(Number(res.body.user.walletBalance)).toBeGreaterThan(0);
  });

  it("rejects registration with a duplicate email", async () => {
    const name = unique("bob");
    const payload = { email: `${name}@test.epitech.eu`, username: name, password: "testpass123" };
    await request(app).post("/auth/register").send(payload).expect(201);

    const res = await request(app)
      .post("/auth/register")
      .send({ ...payload, username: unique("bob2") });
    expect(res.status).toBe(409);
  });

  it("rejects a password shorter than 8 characters", async () => {
    const name = unique("short");
    const res = await request(app)
      .post("/auth/register")
      .send({ email: `${name}@test.epitech.eu`, username: name, password: "short" });
    expect(res.status).toBe(400);
  });

  it("logs in with correct credentials and rejects a wrong password", async () => {
    const name = unique("carol");
    const payload = { email: `${name}@test.epitech.eu`, username: name, password: "testpass123" };
    await request(app).post("/auth/register").send(payload).expect(201);

    const ok = await request(app).post("/auth/login").send({ email: payload.email, password: payload.password });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTypeOf("string");

    const bad = await request(app).post("/auth/login").send({ email: payload.email, password: "wrongpassword" });
    expect(bad.status).toBe(401);
  });

  it("GET /auth/me returns the current user, and 401s without a token", async () => {
    const name = unique("dave");
    const reg = await request(app)
      .post("/auth/register")
      .send({ email: `${name}@test.epitech.eu`, username: name, password: "testpass123" });

    const me = await request(app).get("/auth/me").set("Authorization", `Bearer ${reg.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe(name);

    const anon = await request(app).get("/auth/me");
    expect(anon.status).toBe(401);
  });
});
