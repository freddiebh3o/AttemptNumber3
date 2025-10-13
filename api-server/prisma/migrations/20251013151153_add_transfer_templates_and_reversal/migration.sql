-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'TRANSFER_REVERSE';

-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "isReversal" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversalOfId" TEXT,
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedById" TEXT;

-- CreateTable
CREATE TABLE "StockTransferTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceBranchId" TEXT NOT NULL,
    "destinationBranchId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransferTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "defaultQty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransferTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTransferTemplate_tenantId_idx" ON "StockTransferTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "StockTransferTemplate_sourceBranchId_idx" ON "StockTransferTemplate"("sourceBranchId");

-- CreateIndex
CREATE INDEX "StockTransferTemplate_destinationBranchId_idx" ON "StockTransferTemplate"("destinationBranchId");

-- CreateIndex
CREATE INDEX "StockTransferTemplate_createdByUserId_idx" ON "StockTransferTemplate"("createdByUserId");

-- CreateIndex
CREATE INDEX "StockTransferTemplateItem_productId_idx" ON "StockTransferTemplateItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferTemplateItem_templateId_productId_key" ON "StockTransferTemplateItem"("templateId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_reversalOfId_key" ON "StockTransfer"("reversalOfId");

-- CreateIndex
CREATE INDEX "StockTransfer_reversedById_idx" ON "StockTransfer"("reversedById");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "StockTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferTemplate" ADD CONSTRAINT "StockTransferTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferTemplate" ADD CONSTRAINT "StockTransferTemplate_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferTemplate" ADD CONSTRAINT "StockTransferTemplate_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferTemplate" ADD CONSTRAINT "StockTransferTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferTemplateItem" ADD CONSTRAINT "StockTransferTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "StockTransferTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferTemplateItem" ADD CONSTRAINT "StockTransferTemplateItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
