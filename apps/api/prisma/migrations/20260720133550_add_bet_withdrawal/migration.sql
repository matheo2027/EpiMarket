-- AlterTable
ALTER TABLE "Bet" ADD COLUMN     "chainIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "withdrawnAt" TIMESTAMP(3);
