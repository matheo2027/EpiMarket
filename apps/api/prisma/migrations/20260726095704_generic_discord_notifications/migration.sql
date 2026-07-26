/*
  Warnings:

  - You are about to drop the column `discordNotifiedAt` on the `Bet` table. All the data in the column will be lost.
  - You are about to drop the column `discordWithdrawNotifiedAt` on the `Bet` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DiscordEventType" AS ENUM ('BET_PLACED', 'BET_WITHDRAWN', 'MARKET_RESOLVED');

-- DropIndex
DROP INDEX "Bet_discordNotifiedAt_idx";

-- DropIndex
DROP INDEX "Bet_discordWithdrawNotifiedAt_idx";

-- AlterTable
ALTER TABLE "Bet" DROP COLUMN "discordNotifiedAt",
DROP COLUMN "discordWithdrawNotifiedAt";

-- CreateTable
CREATE TABLE "DiscordNotification" (
    "id" TEXT NOT NULL,
    "eventType" "DiscordEventType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "DiscordNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscordNotification_eventType_notifiedAt_idx" ON "DiscordNotification"("eventType", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordNotification_eventType_entityId_key" ON "DiscordNotification"("eventType", "entityId");
