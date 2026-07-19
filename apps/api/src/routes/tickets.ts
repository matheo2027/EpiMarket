import { Router } from "express";
import { TicketStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { currentUserRole, requireAdmin, requireAuth } from "../middleware/auth.js";

export const ticketsRouter = Router();

const STATUSES = Object.values(TicketStatus);

ticketsRouter.post("/", requireAuth, async (req, res) => {
  const { subject, message, betId, marketId, txHash } = req.body ?? {};

  if (typeof subject !== "string" || subject.trim().length < 3) {
    res.status(400).json({ error: "Subject must be at least 3 characters" });
    return;
  }
  if (typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Message is required" });
    return;
  }
  if (betId !== undefined && typeof betId !== "string") {
    res.status(400).json({ error: "betId must be a string" });
    return;
  }
  if (marketId !== undefined && typeof marketId !== "string") {
    res.status(400).json({ error: "marketId must be a string" });
    return;
  }
  if (txHash !== undefined && typeof txHash !== "string") {
    res.status(400).json({ error: "txHash must be a string" });
    return;
  }

  if (betId) {
    const bet = await prisma.bet.findUnique({ where: { id: betId } });
    if (!bet || bet.userId !== req.user!.userId) {
      res.status(400).json({ error: "Invalid betId" });
      return;
    }
  }
  if (marketId) {
    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) {
      res.status(400).json({ error: "Invalid marketId" });
      return;
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      subject: subject.trim(),
      message: message.trim(),
      userId: req.user!.userId,
      betId: betId ?? null,
      marketId: marketId ?? null,
      txHash: txHash ?? null,
    },
  });

  res.status(201).json({ ticket });
});

ticketsRouter.get("/", requireAuth, async (req, res) => {
  const { all } = req.query;
  const isAdminAll = all === "true" && (await currentUserRole(req.user!.userId)) === "ADMIN";

  const tickets = isAdminAll
    ? await prisma.ticket.findMany({
        include: {
          user: { select: { id: true, email: true, username: true } },
          bet: true,
          market: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : await prisma.ticket.findMany({
        where: { userId: req.user!.userId },
        include: { bet: true, market: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
      });

  res.json({ tickets });
});

ticketsRouter.get("/:id", requireAuth, async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: { bet: true, market: { select: { id: true, title: true } } },
  });
  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }
  if (ticket.userId !== req.user!.userId && (await currentUserRole(req.user!.userId)) !== "ADMIN") {
    res.status(403).json({ error: "Not allowed to view this ticket" });
    return;
  }
  res.json({ ticket });
});

ticketsRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const existing = await prisma.ticket.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const { status, adminNote } = req.body ?? {};
  const data: { status?: TicketStatus; adminNote?: string; resolvedAt?: Date } = {};

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      res.status(400).json({ error: `status must be one of ${STATUSES.join(", ")}` });
      return;
    }
    data.status = status;
    data.resolvedAt = status === "RESOLVED" ? new Date() : undefined;
  }
  if (adminNote !== undefined) {
    if (typeof adminNote !== "string") {
      res.status(400).json({ error: "adminNote must be a string" });
      return;
    }
    data.adminNote = adminNote;
  }

  const ticket = await prisma.ticket.update({ where: { id: existing.id }, data });
  res.json({ ticket });
});
