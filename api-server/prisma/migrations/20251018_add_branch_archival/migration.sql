-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "Branch_tenantId_isArchived_idx" ON "Branch"("tenantId", "isArchived");
