-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN     "contentType" TEXT,
ADD COLUMN     "delayMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "headers" JSONB;
