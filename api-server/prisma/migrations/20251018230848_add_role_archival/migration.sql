-- AlterTable
ALTER TABLE "public"."Role" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedByUserId" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Role_tenantId_isArchived_idx" ON "public"."Role"("tenantId", "isArchived");
