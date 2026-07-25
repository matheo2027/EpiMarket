import "express-async-errors";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { prisma } from "./prisma.js";
import { authRouter } from "./routes/auth.js";
import { betsRouter } from "./routes/bets.js";
import { marketsRouter } from "./routes/markets.js";
import { marketProposalsRouter } from "./routes/marketProposals.js";
import { usersRouter } from "./routes/users.js";
import { ticketsRouter } from "./routes/tickets.js";
import { diagnosticsRouter } from "./routes/diagnostics.js";

export const app = express();
const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:3000").split(",");
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.use("/auth", authRouter);
app.use("/markets", marketsRouter);
app.use("/market-proposals", marketProposalsRouter);
app.use("/bets", betsRouter);
app.use("/users", usersRouter);
app.use("/tickets", ticketsRouter);
app.use("/diagnostics", diagnosticsRouter);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error("Health check failed:", err);
    res.status(500).json({ status: "error", db: "disconnected", message: "Database connection failed" });
  }
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});
