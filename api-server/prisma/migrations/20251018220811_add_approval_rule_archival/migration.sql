-- AlterTable
ALTER TABLE "public"."TransferApprovalRule" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedByUserId" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "TransferApprovalRule_tenantId_isArchived_idx" ON "public"."TransferApprovalRule"("tenantId", "isArchived");
