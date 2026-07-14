import bcrypt from "bcryptjs";
import { Router } from "express";
import { Role } from "@prisma/client";
import { prisma } from "../prisma.js";
import { currentUserRole, requireAdmin, requireAuth } from "../middleware/auth.js";
import { publicUser } from "./auth.js";

export const usersRouter = Router();

const ROLES = Object.values(Role);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

usersRouter.get("/", requireAuth, requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ users: users.map(publicUser) });
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
  try {
    const user = await prisma.user.create({
      data: { email: normalizedEmail, username: normalizedUsername, passwordHash, role: role ?? "USER" },
    });
    res.status(201).json({ user: publicUser(user) });
  } catch (err: unknown) {
    // The findFirst check above is check-then-act: two concurrent creates
    // with the same email/username can both pass it, so the DB's unique
    // constraint is the real guard — translate its violation instead of
    // letting it bubble up as an unhandled 500.
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

  const { username, email, role, walletBalance } = req.body ?? {};
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
  if (walletBalance !== undefined) {
    if (typeof walletBalance !== "number" || !Number.isFinite(walletBalance) || walletBalance < 0) {
      res.status(400).json({ error: "walletBalance must be a non-negative number" });
      return;
    }
    data.walletBalance = walletBalance;
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
