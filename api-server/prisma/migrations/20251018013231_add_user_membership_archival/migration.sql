-- AlterTable
ALTER TABLE "UserTenantMembership" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "UserTenantMembership_tenantId_isArchived_idx" ON "UserTenantMembership"("tenantId", "isArchived");
