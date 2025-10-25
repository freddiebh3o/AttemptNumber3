-- CreateEnum
CREATE TYPE "public"."TransferInitiationType" AS ENUM ('PUSH', 'PULL');

-- AlterTable
ALTER TABLE "public"."StockTransfer" ADD COLUMN     "initiatedByBranchId" TEXT,
ADD COLUMN     "initiationType" "public"."TransferInitiationType" NOT NULL DEFAULT 'PUSH';

-- CreateIndex
CREATE INDEX "StockTransfer_tenantId_initiationType_idx" ON "public"."StockTransfer"("tenantId", "initiationType");

-- CreateIndex
CREATE INDEX "StockTransfer_initiatedByBranchId_idx" ON "public"."StockTransfer"("initiatedByBranchId");

-- AddForeignKey
ALTER TABLE "public"."StockTransfer" ADD CONSTRAINT "StockTransfer_reversedByTransferId_fkey" FOREIGN KEY ("reversedByTransferId") REFERENCES "public"."StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
