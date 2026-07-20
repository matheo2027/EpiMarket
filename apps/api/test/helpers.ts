import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { signToken } from "../src/jwt.js";

export async function resetDb() {
  await prisma.ticket.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.pricePoint.deleteMany();
  await prisma.market.deleteMany();
  await prisma.user.deleteMany();
}

let counter = 0;
export function unique(prefix: string) {
  counter += 1;
  return `${prefix}${Date.now()}${counter}`;
}

export async function registerUser(prefix = "user") {
  const name = unique(prefix);
  const res = await request(app)
    .post("/auth/register")
    .send({ email: `${name}@test.epitech.eu`, username: name, password: "testpass123" });
  if (res.status !== 201) throw new Error(`registerUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token as string, user: res.body.user };
}

export async function createAdmin(prefix = "admin") {
  const name = unique(prefix);
  const passwordHash = await bcrypt.hash("adminpass123", 10);
  const user = await prisma.user.create({
    data: { email: `${name}@test.epitech.eu`, username: name, passwordHash, role: "ADMIN" },
  });
  const token = signToken({ userId: user.id, role: "ADMIN" });
  return { token, user };
}

export function activeWindow() {
  return {
    startDate: new Date(Date.now() - 60_000).toISOString(),
    endDate: new Date(Date.now() + 365 * 86_400_000).toISOString(),
  };
}

export async function createBinaryMarket(adminToken: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/markets")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: unique("Market"),
      description: "Test market",
      category: "OTHER",
      yesDescription: "yes",
      noDescription: "no",
      ...activeWindow(),
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`createBinaryMarket failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.market;
}

export async function createMultiMarket(adminToken: string, overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/markets")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({
      title: unique("Multi"),
      description: "Test multi market",
      category: "SPORTS",
      type: "MULTI",
      options: ["A", "B", "C"],
      ...activeWindow(),
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`createMultiMarket failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.market;
}
