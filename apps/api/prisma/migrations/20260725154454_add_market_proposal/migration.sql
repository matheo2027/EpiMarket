-- CreateEnum
CREATE TYPE "MarketProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "MarketProposal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "MarketType" NOT NULL DEFAULT 'BINARY',
    "yesDescription" TEXT,
    "noDescription" TEXT,
    "optionLabels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category" "MarketCategory" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "MarketProposalStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "proposerId" TEXT NOT NULL,
    "marketId" TEXT,
    "discordMessageId" TEXT,
    "discordChannelId" TEXT,
    "notifiedAt" TIMESTAMP(3),
    "discordSyncedAt" TIMESTAMP(3),

    CONSTRAINT "MarketProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketProposal_marketId_key" ON "MarketProposal"("marketId");

-- CreateIndex
CREATE INDEX "MarketProposal_proposerId_idx" ON "MarketProposal"("proposerId");

-- CreateIndex
CREATE INDEX "MarketProposal_status_idx" ON "MarketProposal"("status");

-- AddForeignKey
ALTER TABLE "MarketProposal" ADD CONSTRAINT "MarketProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketProposal" ADD CONSTRAINT "MarketProposal_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;
