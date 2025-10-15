-- CreateEnum
CREATE TYPE "public"."TransferPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."AuditAction" ADD VALUE 'TRANSFER_PRIORITY_CHANGE';
ALTER TYPE "public"."AuditAction" ADD VALUE 'TRANSFER_SHIP_PARTIAL';

-- DropIndex
DROP INDEX "public"."StockTransfer_tenantId_status_createdAt_idx";

-- AlterTable
ALTER TABLE "public"."StockTransfer" ADD COLUMN     "priority" "public"."TransferPriority" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "public"."StockTransferItem" ADD COLUMN     "shipmentBatches" JSONB;

-- CreateTable
CREATE TABLE "public"."TransferMetrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "transfersCreated" INTEGER NOT NULL DEFAULT 0,
    "transfersApproved" INTEGER NOT NULL DEFAULT 0,
    "transfersShipped" INTEGER NOT NULL DEFAULT 0,
    "transfersCompleted" INTEGER NOT NULL DEFAULT 0,
    "transfersRejected" INTEGER NOT NULL DEFAULT 0,
    "transfersCancelled" INTEGER NOT NULL DEFAULT 0,
    "avgApprovalTime" INTEGER,
    "avgShipTime" INTEGER,
    "avgReceiveTime" INTEGER,
    "avgTotalTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferRouteMetrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceBranchId" TEXT NOT NULL,
    "destinationBranchId" TEXT NOT NULL,
    "metricDate" DATE NOT NULL,
    "transferCount" INTEGER NOT NULL DEFAULT 0,
    "totalUnits" INTEGER NOT NULL DEFAULT 0,
    "avgCompletionTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferRouteMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransferMetrics_tenantId_metricDate_idx" ON "public"."TransferMetrics"("tenantId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "TransferMetrics_tenantId_metricDate_key" ON "public"."TransferMetrics"("tenantId", "metricDate");

-- CreateIndex
CREATE INDEX "TransferRouteMetrics_tenantId_metricDate_idx" ON "public"."TransferRouteMetrics"("tenantId", "metricDate");

-- CreateIndex
CREATE UNIQUE INDEX "TransferRouteMetrics_tenantId_sourceBranchId_destinationBra_key" ON "public"."TransferRouteMetrics"("tenantId", "sourceBranchId", "destinationBranchId", "metricDate");

-- CreateIndex
CREATE INDEX "StockTransfer_tenantId_status_priority_requestedAt_idx" ON "public"."StockTransfer"("tenantId", "status", "priority", "requestedAt");

-- AddForeignKey
ALTER TABLE "public"."TransferMetrics" ADD CONSTRAINT "TransferMetrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferRouteMetrics" ADD CONSTRAINT "TransferRouteMetrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferRouteMetrics" ADD CONSTRAINT "TransferRouteMetrics_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferRouteMetrics" ADD CONSTRAINT "TransferRouteMetrics_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
