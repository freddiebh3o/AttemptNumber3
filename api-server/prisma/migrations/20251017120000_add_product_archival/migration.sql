-- AddProductArchival
-- Add soft delete fields to Product table

ALTER TABLE "Product" ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "archivedByUserId" TEXT;

-- Create index for filtering archived products
CREATE INDEX "Product_isArchived_idx" ON "Product"("isArchived");
