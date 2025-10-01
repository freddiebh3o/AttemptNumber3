/*
  Warnings:

  - Made the column `roleId` on table `UserTenantMembership` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."UserTenantMembership" DROP CONSTRAINT "UserTenantMembership_roleId_fkey";

-- DropIndex
DROP INDEX "public"."UserTenantMembership_tenantId_idx";

-- DropIndex
DROP INDEX "public"."UserTenantMembership_userId_idx";

-- AlterTable
ALTER TABLE "public"."UserTenantMembership" ALTER COLUMN "roleId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "UserTenantMembership_roleId_idx" ON "public"."UserTenantMembership"("roleId");

-- AddForeignKey
ALTER TABLE "public"."UserTenantMembership" ADD CONSTRAINT "UserTenantMembership_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
