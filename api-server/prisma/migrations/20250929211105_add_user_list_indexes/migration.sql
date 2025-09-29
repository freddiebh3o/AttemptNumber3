-- CreateIndex
CREATE INDEX "Product_updatedAt_idx" ON "public"."Product"("updatedAt");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "public"."User"("createdAt");

-- CreateIndex
CREATE INDEX "User_updatedAt_idx" ON "public"."User"("updatedAt");

-- CreateIndex
CREATE INDEX "UserTenantMembership_tenantId_roleName_idx" ON "public"."UserTenantMembership"("tenantId", "roleName");
