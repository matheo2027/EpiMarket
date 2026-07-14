import type { NextFunction, Request, Response } from "express";
import { verifyToken, type JwtPayload } from "../jwt.js";
import { prisma } from "../prisma.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
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

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    // Re-check the role against the database rather than trusting the JWT
    // claim: a token issued before a demotion stays valid for up to 7 days,
    // so trusting req.user.role alone would let a demoted admin keep access.
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { role: true },
    });
    if (user?.role !== "ADMIN") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}
