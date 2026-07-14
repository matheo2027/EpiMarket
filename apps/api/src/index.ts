import "dotenv/config";
// Must be imported before any router is created: it patches Express 4 to
// forward a rejected promise from an async handler to the error middleware
// below, instead of the rejection going unhandled and crashing the process.
import "express-async-errors";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { prisma } from "./prisma.js";
import { authRouter } from "./routes/auth.js";
import { betsRouter } from "./routes/bets.js";
import { marketsRouter } from "./routes/markets.js";
import { usersRouter } from "./routes/users.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);
app.use("/markets", marketsRouter);
app.use("/bets", betsRouter);
app.use("/users", usersRouter);

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", db: "disconnected", message: (err as Error).message });
  }
});

// Catches anything a route handler didn't handle itself (unexpected Prisma
// errors, etc.) and returns a clean 500 instead of letting it crash the
// server for every other in-flight request.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
