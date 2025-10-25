-- AlterTable
ALTER TABLE "StockTransfer" ADD COLUMN     "expectedDeliveryDate" TIMESTAMP(3),
ADD COLUMN     "orderNotes" TEXT,
ADD COLUMN     "reversedByTransferId" TEXT;

-- CreateIndex
CREATE INDEX "StockTransfer_reversedByTransferId_idx" ON "StockTransfer"("reversedByTransferId");

-- CreateIndex
CREATE INDEX "StockTransfer_expectedDeliveryDate_idx" ON "StockTransfer"("expectedDeliveryDate");
