-- AlterTable
ALTER TABLE "User" ADD COLUMN     "keycloakId" TEXT,
ALTER COLUMN "password" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_keycloakId_key" ON "User"("keycloakId");

