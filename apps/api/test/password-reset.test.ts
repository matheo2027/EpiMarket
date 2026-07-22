import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { resetDb, unique } from "./helpers.js";

describe("password reset", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  async function registerWithPassword(prefix: string, password: string) {
    const name = unique(prefix);
    const email = `${name}@test.epitech.eu`;
    await request(app).post("/auth/register").send({ email, username: name, password }).expect(201);
    return { email, username: name };
  }

  it("404s for an email with no account", async () => {
    const res = await request(app).post("/auth/forgot-password").send({ email: "nobody@test.epitech.eu" });
    expect(res.status).toBe(404);
  });

  it("full flow: request a token, reset with it, log in with the new password", async () => {
    const { email } = await registerWithPassword("resetme", "oldpassword1");

    const forgot = await request(app).post("/auth/forgot-password").send({ email });
    expect(forgot.status).toBe(200);
    expect(forgot.body.resetToken).toBeTypeOf("string");

    const reset = await request(app)
      .post("/auth/reset-password")
      .send({ token: forgot.body.resetToken, newPassword: "brandnewpass1" });
    expect(reset.status).toBe(200);

    const loginNew = await request(app).post("/auth/login").send({ email, password: "brandnewpass1" });
    expect(loginNew.status).toBe(200);

    const loginOld = await request(app).post("/auth/login").send({ email, password: "oldpassword1" });
    expect(loginOld.status).toBe(401);
  });

  it("rejects a bogus token and a reused token", async () => {
    const { email } = await registerWithPassword("onetime", "oldpassword1");
    const forgot = await request(app).post("/auth/forgot-password").send({ email });

    const bogus = await request(app)
      .post("/auth/reset-password")
      .send({ token: "not-a-real-token", newPassword: "brandnewpass1" });
    expect(bogus.status).toBe(400);

    await request(app)
      .post("/auth/reset-password")
      .send({ token: forgot.body.resetToken, newPassword: "brandnewpass1" })
      .expect(200);

    const reuse = await request(app)
      .post("/auth/reset-password")
      .send({ token: forgot.body.resetToken, newPassword: "anotherpass1" });
    expect(reuse.status).toBe(400);
  });

  it("rejects a new password shorter than 8 characters", async () => {
    const { email } = await registerWithPassword("shortpw", "oldpassword1");
    const forgot = await request(app).post("/auth/forgot-password").send({ email });

    const res = await request(app)
      .post("/auth/reset-password")
      .send({ token: forgot.body.resetToken, newPassword: "short" });
    expect(res.status).toBe(400);
  });
});
