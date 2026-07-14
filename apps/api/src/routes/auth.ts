import bcrypt from "bcryptjs";
import { Router } from "express";
import { prisma } from "../prisma.js";
import { signToken } from "../jwt.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function publicUser(user: {
  id: string;
  email: string;
  username: string;
  role: "USER" | "ADMIN";
  walletBalance: unknown;
  createdAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    walletBalance: user.walletBalance,
    createdAt: user.createdAt,
  };
}

authRouter.post("/register", async (req, res) => {
  const { email, username, password } = req.body ?? {};

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
      data: { email: normalizedEmail, username: normalizedUsername, passwordHash },
    });
    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err: unknown) {
    // findFirst above is check-then-act: two concurrent registrations with
    // the same email/username can both pass it, so the DB's unique
    // constraint is the real guard — translate its violation instead of
    // letting it bubble up as an unhandled 500.
    if (err instanceof Error && "code" in err && (err as { code: string }).code === "P2002") {
      res.status(409).json({ error: "Email or username already in use" });
      return;
    }
    throw err;
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, role: user.role });
  res.json({ token, user: publicUser(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: publicUser(user) });
});
