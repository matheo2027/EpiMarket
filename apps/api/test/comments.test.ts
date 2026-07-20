import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { createAdmin, createBinaryMarket, registerUser, resetDb } from "./helpers.js";

describe("comments", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("posts a comment and lists it publicly", async () => {
    const admin = await createAdmin();
    const author = await registerUser("commenter");
    const market = await createBinaryMarket(admin.token);

    const post = await request(app)
      .post(`/markets/${market.id}/comments`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ content: "This market feels overpriced." });
    expect(post.status).toBe(201);
    expect(post.body.comment.user.username).toBe(author.user.username);

    const list = await request(app).get(`/markets/${market.id}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.comments).toHaveLength(1);
    expect(list.body.comments[0].content).toBe("This market feels overpriced.");
  });

  it("rejects empty content and content over the length limit", async () => {
    const admin = await createAdmin();
    const author = await registerUser("verbose");
    const market = await createBinaryMarket(admin.token);

    const empty = await request(app)
      .post(`/markets/${market.id}/comments`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ content: "   " });
    expect(empty.status).toBe(400);

    const tooLong = await request(app)
      .post(`/markets/${market.id}/comments`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ content: "a".repeat(1001) });
    expect(tooLong.status).toBe(400);
  });

  it("lets the author delete their own comment, blocks a stranger, allows an admin", async () => {
    const admin = await createAdmin();
    const author = await registerUser("owner2");
    const stranger = await registerUser("stranger2");
    const market = await createBinaryMarket(admin.token);

    const post = await request(app)
      .post(`/markets/${market.id}/comments`)
      .set("Authorization", `Bearer ${author.token}`)
      .send({ content: "delete me maybe" });
    const commentId = post.body.comment.id;

    const strangerDelete = await request(app)
      .delete(`/markets/${market.id}/comments/${commentId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(strangerDelete.status).toBe(403);

    const adminDelete = await request(app)
      .delete(`/markets/${market.id}/comments/${commentId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(adminDelete.status).toBe(204);

    const list = await request(app).get(`/markets/${market.id}/comments`);
    expect(list.body.comments).toHaveLength(0);
  });
});
