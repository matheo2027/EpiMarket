import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { prisma } from "../src/prisma.js";
import { createAdmin, createBinaryMarket, registerUser, resetDb } from "./helpers.js";

describe("tickets", () => {
  beforeEach(resetDb);
  afterAll(async () => {
    await resetDb();
    await prisma.$disconnect();
  });

  it("creates a ticket, optionally linked to a market, and rejects an invalid marketId", async () => {
    const admin = await createAdmin();
    const user = await registerUser("ticketuser");
    const market = await createBinaryMarket(admin.token);

    const created = await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ subject: "Bet missing", message: "My bet doesn't show up", marketId: market.id });
    expect(created.status).toBe(201);
    expect(created.body.ticket.status).toBe("OPEN");
    expect(created.body.ticket.marketId).toBe(market.id);

    const invalidMarket = await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ subject: "Bad market ref", message: "x", marketId: "does-not-exist" });
    expect(invalidMarket.status).toBe(400);

    const tooShortSubject = await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${user.token}`)
      .send({ subject: "hi", message: "x" });
    expect(tooShortSubject.status).toBe(400);
  });

  it("only lists the caller's own tickets unless ?all=true as admin", async () => {
    const admin = await createAdmin();
    const alice = await registerUser("aliceticket");
    const bob = await registerUser("bobticket");

    await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${alice.token}`)
      .send({ subject: "From Alice", message: "x" });
    await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${bob.token}`)
      .send({ subject: "From Bob", message: "x" });

    const aliceOwn = await request(app).get("/tickets").set("Authorization", `Bearer ${alice.token}`);
    expect(aliceOwn.body.tickets).toHaveLength(1);

    const adminAll = await request(app).get("/tickets?all=true").set("Authorization", `Bearer ${admin.token}`);
    expect(adminAll.body.tickets).toHaveLength(2);

    const nonAdminAll = await request(app).get("/tickets?all=true").set("Authorization", `Bearer ${alice.token}`);
    expect(nonAdminAll.body.tickets).toHaveLength(1);
  });

  it("lets the owner or an admin view a ticket, blocks a stranger", async () => {
    const admin = await createAdmin();
    const owner = await registerUser("ticketowner");
    const stranger = await registerUser("ticketstranger");

    const created = await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ subject: "Private issue", message: "x" });
    const ticketId = created.body.ticket.id;

    const asOwner = await request(app).get(`/tickets/${ticketId}`).set("Authorization", `Bearer ${owner.token}`);
    expect(asOwner.status).toBe(200);

    const asAdmin = await request(app).get(`/tickets/${ticketId}`).set("Authorization", `Bearer ${admin.token}`);
    expect(asAdmin.status).toBe(200);

    const asStranger = await request(app).get(`/tickets/${ticketId}`).set("Authorization", `Bearer ${stranger.token}`);
    expect(asStranger.status).toBe(403);
  });

  it("lets an admin update status and adminNote, sets resolvedAt on RESOLVED, blocks a non-admin", async () => {
    const admin = await createAdmin();
    const owner = await registerUser("ticketowner2");

    const created = await request(app)
      .post("/tickets")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ subject: "Needs a reply", message: "x" });
    const ticketId = created.body.ticket.id;

    const deniedForOwner = await request(app)
      .patch(`/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "RESOLVED" });
    expect(deniedForOwner.status).toBe(403);

    const updated = await request(app)
      .patch(`/tickets/${ticketId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "RESOLVED", adminNote: "Fixed your balance." });
    expect(updated.status).toBe(200);
    expect(updated.body.ticket.status).toBe("RESOLVED");
    expect(updated.body.ticket.adminNote).toBe("Fixed your balance.");
    expect(updated.body.ticket.resolvedAt).not.toBeNull();
  });
});
