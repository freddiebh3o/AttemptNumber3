-- CreateTable
CREATE TABLE "public"."TenantBranding" (
    "tenantId" TEXT NOT NULL,
    "presetKey" TEXT,
    "overridesJson" JSONB,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("tenantId")
);

-- AddForeignKey
ALTER TABLE "public"."TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
