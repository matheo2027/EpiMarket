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

function hasValidInternalSecret(req: Request, envVarName: string): boolean {
  const expected = process.env[envVarName];
  return Boolean(expected) && req.headers["x-internal-secret"] === expected;
}

/**
 * For endpoints called only by a specific Discord bot — no human user, just a
 * shared secret. Parameterized by which env var holds that bot's secret so
 * one bot's credential can't be used to call another bot's routes (each bot
 * gets its own `INTERNAL_API_SECRET_*` — see apps/discord-bot/README.md).
 */
export function requireInternalSecret(envVarName: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (!hasValidInternalSecret(req, envVarName)) {
      res.status(401).json({ error: "Invalid internal secret" });
      return;
    }
    req.isInternal = true;
    next();
  };
}

/** Lets the same route be called by an admin's JWT (web panel) or that specific bot's internal secret (Discord buttons). */
export function requireAdminOrInternalSecret(envVarName: string) {
  return function (req: Request, res: Response, next: NextFunction) {
    if (hasValidInternalSecret(req, envVarName)) {
      req.isInternal = true;
      next();
      return;
    }
    // requireAuth never calls next() on failure (it sends the 401 itself), so this
    // callback only ever runs on success — no error-first check needed here.
    requireAuth(req, res, () => requireAdmin(req, res, next));
  };
}
