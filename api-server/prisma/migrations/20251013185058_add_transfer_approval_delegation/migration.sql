-- CreateEnum
CREATE TYPE "public"."ApprovalRuleConditionType" AS ENUM ('TOTAL_QTY_THRESHOLD', 'TOTAL_VALUE_THRESHOLD', 'SOURCE_BRANCH', 'DESTINATION_BRANCH', 'PRODUCT_CATEGORY');

-- CreateEnum
CREATE TYPE "public"."ApprovalMode" AS ENUM ('SEQUENTIAL', 'PARALLEL', 'HYBRID');

-- CreateEnum
CREATE TYPE "public"."ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."AuditAction" ADD VALUE 'TRANSFER_APPROVE_LEVEL';
ALTER TYPE "public"."AuditAction" ADD VALUE 'APPROVAL_RULE_CREATE';
ALTER TYPE "public"."AuditAction" ADD VALUE 'APPROVAL_RULE_UPDATE';
ALTER TYPE "public"."AuditAction" ADD VALUE 'APPROVAL_RULE_DELETE';

-- AlterTable
ALTER TABLE "public"."StockTransfer" ADD COLUMN     "requiresMultiLevelApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."TransferApprovalRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "approvalMode" "public"."ApprovalMode" NOT NULL DEFAULT 'SEQUENTIAL',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferApprovalCondition" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "conditionType" "public"."ApprovalRuleConditionType" NOT NULL,
    "threshold" INTEGER,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferApprovalCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferApprovalLevel" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "requiredRoleId" TEXT,
    "requiredUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferApprovalLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferApprovalRecord" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "levelName" TEXT NOT NULL,
    "status" "public"."ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requiredRoleId" TEXT,
    "requiredUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferApprovalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferApprovalRule_tenantId_isActive_idx" ON "public"."TransferApprovalRule"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "TransferApprovalRule_tenantId_priority_idx" ON "public"."TransferApprovalRule"("tenantId", "priority");

-- CreateIndex
CREATE INDEX "TransferApprovalCondition_ruleId_idx" ON "public"."TransferApprovalCondition"("ruleId");

-- CreateIndex
CREATE INDEX "TransferApprovalCondition_branchId_idx" ON "public"."TransferApprovalCondition"("branchId");

-- CreateIndex
CREATE INDEX "TransferApprovalLevel_ruleId_idx" ON "public"."TransferApprovalLevel"("ruleId");

-- CreateIndex
CREATE INDEX "TransferApprovalLevel_requiredRoleId_idx" ON "public"."TransferApprovalLevel"("requiredRoleId");

-- CreateIndex
CREATE INDEX "TransferApprovalLevel_requiredUserId_idx" ON "public"."TransferApprovalLevel"("requiredUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferApprovalLevel_ruleId_level_key" ON "public"."TransferApprovalLevel"("ruleId", "level");

-- CreateIndex
CREATE INDEX "TransferApprovalRecord_transferId_level_idx" ON "public"."TransferApprovalRecord"("transferId", "level");

-- CreateIndex
CREATE INDEX "TransferApprovalRecord_status_idx" ON "public"."TransferApprovalRecord"("status");

-- CreateIndex
CREATE INDEX "TransferApprovalRecord_requiredRoleId_idx" ON "public"."TransferApprovalRecord"("requiredRoleId");

-- CreateIndex
CREATE INDEX "TransferApprovalRecord_requiredUserId_idx" ON "public"."TransferApprovalRecord"("requiredUserId");

-- CreateIndex
CREATE INDEX "TransferApprovalRecord_approvedByUserId_idx" ON "public"."TransferApprovalRecord"("approvedByUserId");

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalRule" ADD CONSTRAINT "TransferApprovalRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalCondition" ADD CONSTRAINT "TransferApprovalCondition_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."TransferApprovalRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalCondition" ADD CONSTRAINT "TransferApprovalCondition_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalLevel" ADD CONSTRAINT "TransferApprovalLevel_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "public"."TransferApprovalRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalLevel" ADD CONSTRAINT "TransferApprovalLevel_requiredRoleId_fkey" FOREIGN KEY ("requiredRoleId") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalLevel" ADD CONSTRAINT "TransferApprovalLevel_requiredUserId_fkey" FOREIGN KEY ("requiredUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalRecord" ADD CONSTRAINT "TransferApprovalRecord_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "public"."StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalRecord" ADD CONSTRAINT "TransferApprovalRecord_requiredRoleId_fkey" FOREIGN KEY ("requiredRoleId") REFERENCES "public"."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalRecord" ADD CONSTRAINT "TransferApprovalRecord_requiredUserId_fkey" FOREIGN KEY ("requiredUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApprovalRecord" ADD CONSTRAINT "TransferApprovalRecord_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
