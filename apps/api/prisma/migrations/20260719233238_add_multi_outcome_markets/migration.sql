-- CreateEnum
CREATE TYPE "MarketType" AS ENUM ('BINARY', 'MULTI');

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "optionId" TEXT,
ALTER COLUMN "side" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "resolvedOptionId" TEXT,
ADD COLUMN     "type" "MarketType" NOT NULL DEFAULT 'BINARY',
ALTER COLUMN "yesDescription" DROP NOT NULL,
ALTER COLUMN "noDescription" DROP NOT NULL;

-- CreateTable
CREATE TABLE "MarketOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "pool" DECIMAL(18,2) NOT NULL DEFAULT 50,
    "marketId" TEXT NOT NULL,

    CONSTRAINT "MarketOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptionPricePoint" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(5,4) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "OptionPricePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketOption_marketId_idx" ON "MarketOption"("marketId");

-- CreateIndex
CREATE INDEX "OptionPricePoint_optionId_timestamp_idx" ON "OptionPricePoint"("optionId", "timestamp");

-- CreateIndex
CREATE INDEX "Bet_optionId_idx" ON "Bet"("optionId");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_resolvedOptionId_fkey" FOREIGN KEY ("resolvedOptionId") REFERENCES "MarketOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketOption" ADD CONSTRAINT "MarketOption_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MarketOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OptionPricePoint" ADD CONSTRAINT "OptionPricePoint_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "MarketOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
