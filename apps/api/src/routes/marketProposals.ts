import type { Request, Response } from "express";
import { Router } from "express";
import { MarketProposalStatus } from "@prisma/client";
import { prisma } from "../prisma.js";
import { currentUserRole, requireAdminOrInternalSecret, requireAuth, requireInternalSecret } from "../middleware/auth.js";
import { createMarketFromFields, optionsOrder, serializeMarket, validateMarketInput } from "../marketCreation.js";

export const marketProposalsRouter = Router();

const MODERATION_SECRET_VAR = "INTERNAL_API_SECRET_MODERATION";
const requireInternal = requireInternalSecret(MODERATION_SECRET_VAR);
const requireAdminOrInternal = requireAdminOrInternalSecret(MODERATION_SECRET_VAR);

async function findProposalOr404(res: Response, id: string) {
  const proposal = await prisma.marketProposal.findUnique({ where: { id } });
  if (!proposal) {
    res.status(404).json({ error: "Proposal not found" });
    return null;
  }
  return proposal;
}

function decidedByFor(req: Request): string {
  if (req.isInternal) {
    const discordUser = typeof req.body?.discordUser === "string" ? req.body.discordUser : null;
    return discordUser ? `discord:${discordUser}` : "discord-bot";
  }
  return `user:${req.user!.userId}`;
}

function adminNoteFrom(req: Request): string | undefined {
  return typeof req.body?.adminNote === "string" ? req.body.adminNote : undefined;
}

marketProposalsRouter.post("/", requireAuth, async (req, res) => {
  const validated = validateMarketInput(req.body);
  if (!validated.ok) {
    res.status(validated.status).json({ error: validated.error });
    return;
  }

  const { fields } = validated;
  const proposal = await prisma.marketProposal.create({
    data: {
      title: fields.title,
      description: fields.description,
      type: fields.type,
      yesDescription: fields.yesDescription ?? null,
      noDescription: fields.noDescription ?? null,
      optionLabels: fields.optionLabels ?? [],
      category: fields.category,
      startDate: fields.startDate,
      endDate: fields.endDate,
      proposerId: req.user!.userId,
    },
  });

  res.status(201).json({ proposal });
});

marketProposalsRouter.get("/", requireAuth, async (req, res) => {
  const { all } = req.query;
  const isAdminAll = all === "true" && (await currentUserRole(req.user!.userId)) === "ADMIN";

  const proposals = isAdminAll
    ? await prisma.marketProposal.findMany({
        include: {
          proposer: { select: { id: true, email: true, username: true } },
          market: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : await prisma.marketProposal.findMany({
        where: { proposerId: req.user!.userId },
        orderBy: { createdAt: "desc" },
      });

  res.json({ proposals });
});

marketProposalsRouter.get("/pending-unnotified", requireInternal, async (_req, res) => {
  const proposals = await prisma.marketProposal.findMany({
    where: { status: "PENDING", notifiedAt: null },
    include: { proposer: { select: { id: true, username: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json({ proposals });
});

marketProposalsRouter.get("/decided-unsynced", requireInternal, async (_req, res) => {
  const proposals = await prisma.marketProposal.findMany({
    where: {
      status: { in: ["APPROVED", "REJECTED"] satisfies MarketProposalStatus[] },
      discordMessageId: { not: null },
      discordSyncedAt: null,
    },
    include: { proposer: { select: { id: true, username: true } } },
    orderBy: { decidedAt: "asc" },
  });
  res.json({ proposals });
});

marketProposalsRouter.patch("/:id/notify", requireInternal, async (req, res) => {
  const { discordMessageId, discordChannelId } = req.body ?? {};
  if (typeof discordMessageId !== "string" || typeof discordChannelId !== "string") {
    res.status(400).json({ error: "discordMessageId and discordChannelId are required" });
    return;
  }

  const proposal = await prisma.marketProposal.update({
    where: { id: req.params.id },
    data: { discordMessageId, discordChannelId, notifiedAt: new Date() },
  });
  res.json({ proposal });
});

marketProposalsRouter.patch("/:id/sync", requireInternal, async (req, res) => {
  const proposal = await prisma.marketProposal.update({
    where: { id: req.params.id },
    data: { discordSyncedAt: new Date() },
  });
  res.json({ proposal });
});

marketProposalsRouter.post("/:id/approve", requireAdminOrInternal, async (req, res) => {
  const proposal = await findProposalOr404(res, req.params.id);
  if (!proposal) return;

  if (proposal.status === "APPROVED") {
    const market = await prisma.market.findUnique({ where: { id: proposal.marketId! }, include: optionsOrder });
    res.status(200).json({ proposal, market: market ? serializeMarket(market) : null });
    return;
  }
  if (proposal.status === "REJECTED") {
    res.status(409).json({ error: "Proposal already rejected" });
    return;
  }

  const result = await createMarketFromFields({
    title: proposal.title,
    description: proposal.description,
    category: proposal.category,
    startDate: proposal.startDate,
    endDate: proposal.endDate,
    type: proposal.type,
    optionLabels: proposal.optionLabels,
    yesDescription: proposal.yesDescription,
    noDescription: proposal.noDescription,
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  const updated = await prisma.marketProposal.update({
    where: { id: proposal.id },
    data: {
      status: "APPROVED",
      marketId: result.market.id,
      decidedAt: new Date(),
      decidedBy: decidedByFor(req),
      adminNote: adminNoteFrom(req),
    },
  });

  res.status(201).json({ proposal: updated, market: serializeMarket(result.market) });
});

marketProposalsRouter.post("/:id/reject", requireAdminOrInternal, async (req, res) => {
  const proposal = await findProposalOr404(res, req.params.id);
  if (!proposal) return;

  if (proposal.status === "REJECTED") {
    res.status(200).json({ proposal });
    return;
  }
  if (proposal.status === "APPROVED") {
    res.status(409).json({ error: "Proposal already approved" });
    return;
  }

  const updated = await prisma.marketProposal.update({
    where: { id: proposal.id },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedBy: decidedByFor(req),
      adminNote: adminNoteFrom(req),
    },
  });

  res.status(200).json({ proposal: updated });
});
