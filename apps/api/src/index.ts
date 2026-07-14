import "dotenv/config";
import cors from "cors";
import express from "express";
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

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
