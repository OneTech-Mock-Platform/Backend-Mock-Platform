-- AlterTable
ALTER TABLE "Scenario" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT;
