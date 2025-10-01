/*
  Warnings:

  - You are about to drop the column `roleName` on the `UserTenantMembership` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "public"."UserTenantMembership_roleId_idx";

-- DropIndex
DROP INDEX "public"."UserTenantMembership_tenantId_roleName_idx";

-- AlterTable
ALTER TABLE "public"."UserTenantMembership" DROP COLUMN "roleName";

-- DropEnum
DROP TYPE "public"."RoleName";
