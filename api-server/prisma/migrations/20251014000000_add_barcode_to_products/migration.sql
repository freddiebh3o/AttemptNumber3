-- AlterTable
-- Add barcode fields to Product table (nullable to allow gradual adoption)
ALTER TABLE "public"."Product" ADD COLUMN "barcode" TEXT;
ALTER TABLE "public"."Product" ADD COLUMN "barcodeType" TEXT;

-- CreateIndex
-- Create index on barcode field for fast lookups
CREATE INDEX "Product_barcode_idx" ON "public"."Product"("barcode");

-- CreateIndex
-- Create unique constraint on tenantId + barcode (barcode must be unique per tenant)
CREATE UNIQUE INDEX "Product_tenantId_barcode_key" ON "public"."Product"("tenantId", "barcode");
