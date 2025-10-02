-- CreateEnum
CREATE TYPE "public"."StockMovementKind" AS ENUM ('RECEIPT', 'ADJUSTMENT', 'CONSUMPTION', 'REVERSAL');

-- CreateTable
CREATE TABLE "public"."Branch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchSlug" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserBranchMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBranchMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductStock" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyOnHand" INTEGER NOT NULL DEFAULT 0,
    "qtyAllocated" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockLot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyReceived" INTEGER NOT NULL,
    "qtyRemaining" INTEGER NOT NULL,
    "unitCostCents" INTEGER,
    "sourceRef" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."StockLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotId" TEXT,
    "kind" "public"."StockMovementKind" NOT NULL,
    "qtyDelta" INTEGER NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_tenantId_idx" ON "public"."Branch"("tenantId");

-- CreateIndex
CREATE INDEX "Branch_tenantId_branchName_idx" ON "public"."Branch"("tenantId", "branchName");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_tenantId_branchSlug_key" ON "public"."Branch"("tenantId", "branchSlug");

-- CreateIndex
CREATE INDEX "UserBranchMembership_tenantId_idx" ON "public"."UserBranchMembership"("tenantId");

-- CreateIndex
CREATE INDEX "UserBranchMembership_userId_idx" ON "public"."UserBranchMembership"("userId");

-- CreateIndex
CREATE INDEX "UserBranchMembership_branchId_idx" ON "public"."UserBranchMembership"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBranchMembership_userId_branchId_key" ON "public"."UserBranchMembership"("userId", "branchId");

-- CreateIndex
CREATE INDEX "ProductStock_branchId_idx" ON "public"."ProductStock"("branchId");

-- CreateIndex
CREATE INDEX "ProductStock_productId_idx" ON "public"."ProductStock"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductStock_tenantId_branchId_productId_key" ON "public"."ProductStock"("tenantId", "branchId", "productId");

-- CreateIndex
CREATE INDEX "StockLot_tenantId_branchId_productId_receivedAt_idx" ON "public"."StockLot"("tenantId", "branchId", "productId", "receivedAt");

-- CreateIndex
CREATE INDEX "StockLot_branchId_productId_idx" ON "public"."StockLot"("branchId", "productId");

-- CreateIndex
CREATE INDEX "StockLedger_tenantId_branchId_productId_occurredAt_idx" ON "public"."StockLedger"("tenantId", "branchId", "productId", "occurredAt");

-- CreateIndex
CREATE INDEX "StockLedger_kind_idx" ON "public"."StockLedger"("kind");

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBranchMembership" ADD CONSTRAINT "UserBranchMembership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductStock" ADD CONSTRAINT "ProductStock_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductStock" ADD CONSTRAINT "ProductStock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductStock" ADD CONSTRAINT "ProductStock_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockLot" ADD CONSTRAINT "StockLot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockLot" ADD CONSTRAINT "StockLot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockLot" ADD CONSTRAINT "StockLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockLedger" ADD CONSTRAINT "StockLedger_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockLedger" ADD CONSTRAINT "StockLedger_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockLedger" ADD CONSTRAINT "StockLedger_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockLedger" ADD CONSTRAINT "StockLedger_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "public"."StockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."StockLedger" ADD CONSTRAINT "StockLedger_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
