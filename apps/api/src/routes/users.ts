import bcrypt from "bcryptjs";
import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { currentUserRole, requireAdmin, requireAuth } from "../middleware/auth.js";
import { publicUser } from "./auth.js";
import { encryptPrivateKey, generateCustodialWallet } from "../blockchain/wallet.js";
import { provisionNewWallet } from "../blockchain/contract.js";

export const usersRouter = Router();

const ROLES = Object.values(Role);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

usersRouter.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ users: users.map(publicUser) });
});

usersRouter.get("/stats", requireAuth, requireAdmin, async (_req, res) => {
  const [totalUsers, totalMarkets, openMarkets, totalBets, volumeAgg] = await Promise.all([
    prisma.user.count(),
    prisma.market.count(),
    prisma.market.count({ where: { status: "OPEN" } }),
    prisma.bet.count(),
    prisma.market.aggregate({ _sum: { totalVolume: true } }),
  ]);

  res.json({
    stats: {
      totalUsers,
      totalMarkets,
      openMarkets,
      resolvedMarkets: totalMarkets - openMarkets,
      totalBets,
      totalVolume: volumeAgg._sum.totalVolume?.toString() ?? "0",
    },
  });
});

usersRouter.get("/leaderboard", async (_req, res) => {
  const resolvedBets = await prisma.bet.groupBy({
    by: ["userId"],
    where: { market: { status: "RESOLVED" } },
    _sum: { amount: true, payout: true },
    _count: true,
  });

  const wins = await prisma.bet.groupBy({
    by: ["userId"],
    where: { market: { status: "RESOLVED" }, payout: { gt: 0 } },
    _count: true,
  });
  const winsByUser = new Map(wins.map((w) => [w.userId, w._count]));

  const users = await prisma.user.findMany({
    where: { id: { in: resolvedBets.map((b) => b.userId) } },
    select: { id: true, username: true },
  });
  const usernameById = new Map(users.map((u) => [u.id, u.username]));

  const leaderboard = resolvedBets
    .map((b) => {
      const totalWagered = Number(b._sum.amount ?? 0);
      const totalWon = Number(b._sum.payout ?? 0);
      return {
        userId: b.userId,
        username: usernameById.get(b.userId) ?? "—",
        netPnl: totalWon - totalWagered,
        winRate: b._count > 0 ? (winsByUser.get(b.userId) ?? 0) / b._count : 0,
        resolvedCount: b._count,
      };
    })
    .sort((a, b) => b.netPnl - a.netPnl)
    .slice(0, 50);

  res.json({ leaderboard });
});

usersRouter.get("/:id", requireAuth, async (req, res) => {
  if (req.user!.userId !== req.params.id && (await currentUserRole(req.user!.userId)) !== "ADMIN") {
    res.status(403).json({ error: "Not allowed to view this user" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: publicUser(user) });
});

usersRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  const { email, username, password, role } = req.body ?? {};

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    res.status(400).json({ error: "Invalid email" });
    return;
  }
  if (typeof username !== "string" || username.trim().length < 3) {
    res.status(400).json({ error: "Username must be at least 3 characters" });
    return;
  }
  if (typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  if (role !== undefined && !ROLES.includes(role)) {
    res.status(400).json({ error: `role must be one of ${ROLES.join(", ")}` });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: normalizedEmail }, { username: normalizedUsername }] },
  });
  if (existing) {
    res.status(409).json({ error: "Email or username already in use" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const resolvedRole = role ?? "USER";
  const wallet = resolvedRole === "ADMIN" ? undefined : generateCustodialWallet();
  try {
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
        role: resolvedRole,
        walletAddress: wallet?.address,
        encryptedPrivateKey: wallet ? encryptPrivateKey(wallet.privateKey) : undefined,
      },
    });

    if (wallet) {
      await provisionNewWallet(user.id, wallet.address);
    }
    const freshUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    res.status(201).json({ user: publicUser(freshUser) });
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      res.status(409).json({ error: "Email or username already in use" });
      return;
    }
    throw err;
  }
});

usersRouter.patch("/:id", requireAuth, requireAdmin, async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const { username, email, role } = req.body ?? {};
  const data: Record<string, unknown> = {};

  if (username !== undefined) {
    if (typeof username !== "string" || username.trim().length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters" });
      return;
    }
    data.username = username.trim();
  }
  if (email !== undefined) {
    if (typeof email !== "string" || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: "Invalid email" });
      return;
    }
    data.email = email.trim().toLowerCase();
  }
  if (role !== undefined) {
    if (!ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of ${ROLES.join(", ")}` });
      return;
    }
    data.role = role;
  }

  try {
    const user = await prisma.user.update({ where: { id: existing.id }, data });
    res.json({ user: publicUser(user) });
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      res.status(409).json({ error: "Email or username already in use" });
      return;
    }
    throw err;
  }
});

usersRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  if (req.user!.userId === req.params.id) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const betCount = await prisma.bet.count({ where: { userId: existing.id } });
  if (betCount > 0) {
    res.status(400).json({ error: "Cannot delete a user that has placed bets" });
    return;
  }

  await prisma.user.delete({ where: { id: existing.id } });
  res.status(204).send();
});
