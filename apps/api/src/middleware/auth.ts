import type { NextFunction, Request, Response } from "express";
import { verifyToken, type JwtPayload } from "../jwt.js";
import { prisma } from "../prisma.js";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      isInternal?: boolean;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    req.user = verifyToken(header.slice("Bearer ".length));
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function currentUserRole(userId: string): Promise<"USER" | "ADMIN" | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role ?? null;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const role = await currentUserRole(req.user!.userId);
    if (role !== "ADMIN") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

function hasValidInternalSecret(req: Request): boolean {
  const expected = process.env.INTERNAL_API_SECRET;
  return Boolean(expected) && req.headers["x-internal-secret"] === expected;
}

/** For endpoints called only by the Discord bot — no human user, just a shared secret. */
export function requireInternal(req: Request, res: Response, next: NextFunction) {
  if (!hasValidInternalSecret(req)) {
    res.status(401).json({ error: "Invalid internal secret" });
    return;
  }
  req.isInternal = true;
  next();
}

/** Lets the same route be called by an admin's JWT (web panel) or the bot's internal secret (Discord buttons). */
export function requireAdminOrInternal(req: Request, res: Response, next: NextFunction) {
  if (hasValidInternalSecret(req)) {
    req.isInternal = true;
    next();
    return;
  }
  // requireAuth never calls next() on failure (it sends the 401 itself), so this
  // callback only ever runs on success — no error-first check needed here.
  requireAuth(req, res, () => requireAdmin(req, res, next));
}
