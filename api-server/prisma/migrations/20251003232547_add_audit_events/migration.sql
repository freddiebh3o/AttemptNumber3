-- CreateEnum
CREATE TYPE "public"."AuditEntityType" AS ENUM ('PRODUCT', 'BRANCH', 'STOCK_LOT', 'STOCK_LEDGER', 'PRODUCT_STOCK', 'USER', 'ROLE', 'TENANT');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STOCK_RECEIVE', 'STOCK_ADJUST', 'STOCK_CONSUME', 'ROLE_ASSIGN', 'ROLE_REVOKE', 'LOGIN', 'LOGOUT');

-- CreateTable
CREATE TABLE "public"."AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" "public"."AuditEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "entityName" TEXT,
    "beforeJson" JSONB,
    "afterJson" JSONB,
    "diffJson" JSONB,
    "correlationId" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_entityType_entityId_createdAt_idx" ON "public"."AuditEvent"("tenantId", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "public"."AuditEvent"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "public"."AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_correlationId_idx" ON "public"."AuditEvent"("correlationId");

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
