-- Remove redundant reversedById column (superseded by reversedByTransferId)
-- This migration cleans up the schema to use only reversedByTransferId for bidirectional reversal linking

-- Drop index on old column
DROP INDEX IF EXISTS "StockTransfer_reversedById_idx";

-- Drop the redundant column
ALTER TABLE "StockTransfer" DROP COLUMN IF EXISTS "reversedById";
