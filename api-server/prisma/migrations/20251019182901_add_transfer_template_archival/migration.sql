-- AlterTable
ALTER TABLE "public"."StockTransferTemplate" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "archivedByUserId" TEXT,
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "StockTransferTemplate_tenantId_isArchived_idx" ON "public"."StockTransferTemplate"("tenantId", "isArchived");

-- AddForeignKey
ALTER TABLE "public"."StockTransferTemplate" ADD CONSTRAINT "StockTransferTemplate_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
