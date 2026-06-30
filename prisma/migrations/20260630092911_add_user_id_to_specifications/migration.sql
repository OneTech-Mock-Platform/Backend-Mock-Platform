-- AlterTable
ALTER TABLE "OpenApiSpec" ADD COLUMN     "userId" INTEGER;

-- AddForeignKey
ALTER TABLE "OpenApiSpec" ADD CONSTRAINT "OpenApiSpec_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
