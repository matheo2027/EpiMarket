import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { createAdmin, createProposal, registerUser, resetDb } from "./helpers.js";

const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET_MODERATION!;

describe("market proposals", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("lets a regular user propose a market but not approve it", async () => {
    const user = await registerUser("proposer");
    const proposal = await createProposal(user.token);
    expect(proposal.status).toBe("PENDING");

    const denied = await request(app)
      .post(`/market-proposals/${proposal.id}/approve`)
      .set("Authorization", `Bearer ${user.token}`);
    expect(denied.status).toBe(403);
  });

  it("rejects internal-only routes without a valid secret", async () => {
    const missing = await request(app).get("/market-proposals/pending-unnotified");
    expect(missing.status).toBe(401);

    const wrong = await request(app).get("/market-proposals/pending-unnotified").set("X-Internal-Secret", "nope");
    expect(wrong.status).toBe(401);

    const ok = await request(app).get("/market-proposals/pending-unnotified").set("X-Internal-Secret", INTERNAL_SECRET);
    expect(ok.status).toBe(200);
  });

  it("rejects the bets bot's secret on the proposals routes — each bot's secret only unlocks its own routes", async () => {
    const betsSecret = process.env.INTERNAL_API_SECRET_BETS!;
    const crossSecret = await request(app).get("/market-proposals/pending-unnotified").set("X-Internal-Secret", betsSecret);
    expect(crossSecret.status).toBe(401);
  });

  it("admin approval creates a real market and is idempotent", async () => {
    const admin = await createAdmin();
    const user = await registerUser("proposer2");
    const proposal = await createProposal(user.token);

    const approve = await request(app)
      .post(`/market-proposals/${proposal.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(approve.status).toBe(201);
    expect(approve.body.market.status).toBe("OPEN");
    const marketId = approve.body.market.id;

    // A second approval (e.g. a race with a Discord button click) must not
    // create a second market or error out — it just returns the same result.
    const again = await request(app)
      .post(`/market-proposals/${proposal.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(again.status).toBe(200);
    expect(again.body.market.id).toBe(marketId);
  });

  it("rejects a pending proposal and refuses to approve it afterwards", async () => {
    const admin = await createAdmin();
    const user = await registerUser("proposer3");
    const proposal = await createProposal(user.token);

    const reject = await request(app)
      .post(`/market-proposals/${proposal.id}/reject`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ adminNote: "Doublon" });
    expect(reject.status).toBe(200);
    expect(reject.body.proposal.status).toBe("REJECTED");
    expect(reject.body.proposal.adminNote).toBe("Doublon");

    const approveAfter = await request(app)
      .post(`/market-proposals/${proposal.id}/approve`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(approveAfter.status).toBe(409);
  });

  it("lets the bot approve a proposal via the internal secret", async () => {
    const user = await registerUser("proposer4");
    const proposal = await createProposal(user.token, { type: "MULTI", options: ["A", "B", "C"] });

    const approve = await request(app)
      .post(`/market-proposals/${proposal.id}/approve`)
      .set("X-Internal-Secret", INTERNAL_SECRET);
    expect(approve.status).toBe(201);
    expect(approve.body.proposal.decidedBy).toBe("discord-bot");
    expect(approve.body.market.type).toBe("MULTI");
  });

  it("records the acting Discord user's tag in decidedBy when the bot provides one", async () => {
    const user = await registerUser("proposer6");
    const proposal = await createProposal(user.token);

    const reject = await request(app)
      .post(`/market-proposals/${proposal.id}/reject`)
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ discordUser: "Admin#0001" });
    expect(reject.status).toBe(200);
    expect(reject.body.proposal.decidedBy).toBe("discord:Admin#0001");
  });

  it("only lists the caller's own proposals unless ?all=true as admin", async () => {
    const admin = await createAdmin();
    const userA = await registerUser("proposera");
    const userB = await registerUser("proposerb");
    await createProposal(userA.token, { title: "From A" });
    await createProposal(userB.token, { title: "From B" });

    const ownOnly = await request(app).get("/market-proposals").set("Authorization", `Bearer ${userA.token}`);
    expect(ownOnly.body.proposals).toHaveLength(1);

    const all = await request(app).get("/market-proposals?all=true").set("Authorization", `Bearer ${admin.token}`);
    expect(all.body.proposals).toHaveLength(2);

    const nonAdminAll = await request(app).get("/market-proposals?all=true").set("Authorization", `Bearer ${userA.token}`);
    expect(nonAdminAll.body.proposals).toHaveLength(1);
  });

  it("marks a proposal notified and synced for the bot's poll loop", async () => {
    const user = await registerUser("proposer5");
    const proposal = await createProposal(user.token);

    const notify = await request(app)
      .patch(`/market-proposals/${proposal.id}/notify`)
      .set("X-Internal-Secret", INTERNAL_SECRET)
      .send({ discordMessageId: "msg1", discordChannelId: "chan1" });
    expect(notify.status).toBe(200);
    expect(notify.body.proposal.notifiedAt).not.toBeNull();

    const admin = await createAdmin();
    await request(app).post(`/market-proposals/${proposal.id}/reject`).set("Authorization", `Bearer ${admin.token}`);

    const unsynced = await request(app)
      .get("/market-proposals/decided-unsynced")
      .set("X-Internal-Secret", INTERNAL_SECRET);
    expect(unsynced.body.proposals.map((p: { id: string }) => p.id)).toContain(proposal.id);

    const sync = await request(app)
      .patch(`/market-proposals/${proposal.id}/sync`)
      .set("X-Internal-Secret", INTERNAL_SECRET);
    expect(sync.status).toBe(200);

    const afterSync = await request(app)
      .get("/market-proposals/decided-unsynced")
      .set("X-Internal-Secret", INTERNAL_SECRET);
    expect(afterSync.body.proposals.map((p: { id: string }) => p.id)).not.toContain(proposal.id);
  });
});
