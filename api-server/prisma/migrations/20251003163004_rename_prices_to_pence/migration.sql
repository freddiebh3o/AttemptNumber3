/*
  Warnings:

  - You are about to drop the column `productPriceCents` on the `Product` table. All the data in the column will be lost.
  - You are about to drop the column `unitCostCents` on the `StockLot` table. All the data in the column will be lost.
  - Added the required column `productPricePence` to the `Product` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Product" DROP COLUMN "productPriceCents",
ADD COLUMN     "productPricePence" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."StockLot" DROP COLUMN "unitCostCents",
ADD COLUMN     "unitCostPence" INTEGER;
