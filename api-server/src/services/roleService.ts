// api-server/src/services/roleService.ts
import { Prisma } from "@prisma/client";
import { prismaClientInstance as prisma } from "../db/prismaClient.js";
import { Errors } from "../utils/httpErrors.js";

const dateAddDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
const norm = (s: string) => s.trim(); // keep DB collation behavior; prevent " Admin " dupes

async function getPermissionIdMap() {
  const rows = await prisma.permission.findMany({
    select: { id: true, key: true },
  });
  return new Map(rows.map((r) => [r.key, r.id] as const));
}

export async function listPermissionsService() {
  const rows = await prisma.permission.findMany({ orderBy: { key: "asc" } });
  return rows.map((p) => ({
    id: p.id,
    key: p.key,
    description: p.description,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export async function listTenantRolesService(params: {
  currentTenantId: string;
  limitOptional?: number;
  cursorIdOptional?: string;
  qOptional?: string;
  nameOptional?: string;
  isSystemOptional?: boolean;
  createdAtFromOptional?: string;
  createdAtToOptional?: string;
  updatedAtFromOptional?: string;
  updatedAtToOptional?: string;
  sortByOptional?: "name" | "createdAt" | "updatedAt" | "isSystem";
  sortDirOptional?: "asc" | "desc";
  includeTotalOptional?: boolean;

  // NEW
  permissionKeysOptional?: string[];
  permMatchOptional?: "any" | "all";
}) {
  const {
    currentTenantId,
    limitOptional = 20,
    cursorIdOptional,
    qOptional,
    nameOptional,
    isSystemOptional,
    createdAtFromOptional,
    createdAtToOptional,
    updatedAtFromOptional,
    updatedAtToOptional,
    sortByOptional = "updatedAt",
    sortDirOptional = "desc",
    includeTotalOptional = false,
    permissionKeysOptional,
    permMatchOptional = "any",
  } = params;

  const createdAt: Prisma.DateTimeFilter = {};
  if (createdAtFromOptional) createdAt.gte = new Date(createdAtFromOptional);
  if (createdAtToOptional)
    createdAt.lt = dateAddDays(new Date(createdAtToOptional), 1);

  const updatedAt: Prisma.DateTimeFilter = {};
  if (updatedAtFromOptional) updatedAt.gte = new Date(updatedAtFromOptional);
  if (updatedAtToOptional)
    updatedAt.lt = dateAddDays(new Date(updatedAtToOptional), 1);

  const where: Prisma.RoleWhereInput = {
    tenantId: currentTenantId,
    ...(qOptional && {
      OR: [
        { name: { contains: qOptional, mode: "insensitive" } },
        { description: { contains: qOptional, mode: "insensitive" } },
      ],
    }),
    ...(nameOptional && {
      name: { contains: nameOptional, mode: "insensitive" },
    }),
    ...(isSystemOptional !== undefined && { isSystem: isSystemOptional }),
    ...((createdAt.gte || createdAt.lt) && { createdAt }),
    ...((updatedAt.gte || updatedAt.lt) && { updatedAt }),
  };

  if (permissionKeysOptional && permissionKeysOptional.length > 0) {
    const uniqueKeys = [...new Set(permissionKeysOptional)];

    if (permMatchOptional === "all") {
      // Must contain EVERY selected permission
      const allClauses: Prisma.RoleWhereInput[] = uniqueKeys.map((k) => ({
        permissions: { some: { permission: { key: k } } },
      }));

      const existingAND: Prisma.RoleWhereInput[] = Array.isArray(where.AND)
        ? where.AND
        : where.AND
        ? [where.AND]
        : [];

      where.AND = [...existingAND, ...allClauses];
    } else {
      // ANY: contains at least one of the selected permissions
      where.permissions = {
        some: { permission: { key: { in: uniqueKeys } } },
      };
    }
  }

  const orderBy: Prisma.RoleOrderByWithRelationInput[] =
    sortByOptional === "name"
      ? [{ name: sortDirOptional }, { id: sortDirOptional }]
      : sortByOptional === "isSystem"
      ? [{ isSystem: sortDirOptional }, { id: sortDirOptional }]
      : [
          {
            [sortByOptional]: sortDirOptional,
          } as Prisma.RoleOrderByWithRelationInput,
          { id: sortDirOptional },
        ];

  const take = Math.max(1, Math.min(100, limitOptional));
  const cursor = cursorIdOptional ? { id: cursorIdOptional } : undefined;

  const takePlusOne = Math.min(101, take + 1);

  const [rawRows, total] = await Promise.all([
    prisma.role.findMany({
      where,
      take: takePlusOne,
      ...(cursor && { skip: 1, cursor }),
      orderBy,
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        isSystem: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    }),
    includeTotalOptional ? prisma.role.count({ where }) : Promise.resolve(0),
  ]);

  const hasNextPage = rawRows.length > take;
  const pageRows = hasNextPage ? rawRows.slice(0, take) : rawRows;
  const nextCursor = hasNextPage ? pageRows[pageRows.length - 1]!.id : null;

  const items = pageRows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId ?? "",
    name: r.name,
    description: r.description ?? null,
    isSystem: r.isSystem,
    permissions: r.permissions.map((p) => p.permission.key).sort(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
      ...(includeTotalOptional ? { totalCount: total } : {}),
    },
    applied: {
      limit: take,
      sort: { field: sortByOptional, direction: sortDirOptional },
      filters: {
        ...(qOptional ? { q: qOptional } : {}),
        ...(nameOptional ? { name: nameOptional } : {}),
        ...(isSystemOptional !== undefined
          ? { isSystem: isSystemOptional }
          : {}),
        ...(createdAtFromOptional
          ? { createdAtFrom: createdAtFromOptional }
          : {}),
        ...(createdAtToOptional ? { createdAtTo: createdAtToOptional } : {}),
        ...(updatedAtFromOptional
          ? { updatedAtFrom: updatedAtFromOptional }
          : {}),
        ...(updatedAtToOptional ? { updatedAtTo: updatedAtToOptional } : {}),
        ...(permissionKeysOptional && permissionKeysOptional.length
          ? {
              permissionKeys: permissionKeysOptional,
              permMatch: permMatchOptional,
            }
          : {}),
      },
    },
  };
}

export async function createTenantRoleService(params: {
  currentTenantId: string;
  name: string;
  description?: string | null;
  permissionKeys: string[];
}) {
  const { currentTenantId, name, description = null, permissionKeys } = params;
  const trimmedName = norm(name);

  // Uniqueness (case-sensitive in DB; enforce at app level too)
  const existing = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId: currentTenantId, name: trimmedName } },
    select: { id: true },
  });
  if (existing)
    throw Errors.conflict(
      "A role with this name already exists for this tenant."
    );

  const permIdByKey = await getPermissionIdMap();
  const ids: string[] = [];
  for (const key of permissionKeys) {
    const id = permIdByKey.get(key);
    if (!id)
      return Promise.reject(
        Errors.validation(
          "Unknown permission key",
          `Invalid permission: ${key}`
        )
      );
    ids.push(id);
  }

  const role = await prisma.role.create({
    data: {
      tenantId: currentTenantId,
      name: trimmedName,
      description,
      isSystem: false,
    },
  });

  if (ids.length) {
    await prisma.rolePermission.createMany({
      data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  const withPerms = await prisma.role.findUnique({
    where: { id: role.id },
    select: {
      id: true,
      tenantId: true,
      name: true,
      description: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!withPerms) throw Errors.internal("Role not found after creation");

  return {
    id: withPerms.id,
    tenantId: withPerms.tenantId ?? "",
    name: withPerms.name,
    description: withPerms.description ?? null,
    isSystem: withPerms.isSystem,
    permissions: withPerms.permissions.map((p) => p.permission.key).sort(),
    createdAt: withPerms.createdAt.toISOString(),
    updatedAt: withPerms.updatedAt.toISOString(),
  };
}

export async function updateTenantRoleService(params: {
  currentTenantId: string;
  roleId: string;
  nameOptional?: string;
  descriptionOptional?: string | null;
  permissionKeysOptional?: string[];
}) {
  const { currentTenantId, roleId } = params;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      isSystem: true,
      permissions: {
        select: { permissionId: true, permission: { select: { key: true } } },
      },
    },
  });
  if (!role || role.tenantId !== currentTenantId)
    throw Errors.notFound("Role not found for this tenant.");
  if (role.isSystem) throw Errors.conflict("System roles cannot be modified.");

  // Rename / description
  if (
    params.nameOptional !== undefined ||
    params.descriptionOptional !== undefined
  ) {
    const data: { name?: string; description?: string | null } = {};
    if (params.nameOptional !== undefined) {
      const newName = norm(params.nameOptional);
      if (newName !== role.name) {
        const dup = await prisma.role.findUnique({
          where: {
            tenantId_name: { tenantId: currentTenantId, name: newName },
          },
          select: { id: true },
        });
        if (dup)
          throw Errors.conflict(
            "A role with this name already exists for this tenant."
          );
      }
      data.name = newName;
    }
    if (params.descriptionOptional !== undefined)
      data.description = params.descriptionOptional;
    await prisma.role.update({ where: { id: roleId }, data });
  }

  // Permission set changes
  if (params.permissionKeysOptional !== undefined) {
    const permIdByKey = await getPermissionIdMap();
    const wantIds = new Set(
      params.permissionKeysOptional.map((k) => {
        const id = permIdByKey.get(k);
        if (!id)
          throw Errors.validation(
            "Unknown permission key",
            `Invalid permission: ${k}`
          );
        return id;
      })
    );

    const haveIds = new Set(role.permissions.map((p) => p.permissionId));

    const toAdd = [...wantIds].filter((id) => !haveIds.has(id));
    const toRemove = [...haveIds].filter((id) => !wantIds.has(id));

    if (toAdd.length) {
      await prisma.rolePermission.createMany({
        data: toAdd.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    }
    if (toRemove.length) {
      await prisma.rolePermission.deleteMany({
        where: { roleId, permissionId: { in: toRemove } },
      });
    }
  }

  // Return fresh
  const fresh = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      description: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });
  if (!fresh) throw Errors.internal("State mismatch after update.");

  return {
    id: fresh.id,
    tenantId: fresh.tenantId ?? "",
    name: fresh.name,
    description: fresh.description ?? null,
    isSystem: fresh.isSystem,
    permissions: fresh.permissions.map((p) => p.permission.key).sort(),
    createdAt: fresh.createdAt.toISOString(),
    updatedAt: fresh.updatedAt.toISOString(),
  };
}

export async function deleteTenantRoleService(params: {
  currentTenantId: string;
  roleId: string;
}) {
  const { currentTenantId, roleId } = params;

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, tenantId: true, isSystem: true },
  });
  if (!role || role.tenantId !== currentTenantId)
    throw Errors.notFound("Role not found for this tenant.");
  if (role.isSystem) throw Errors.conflict("System roles cannot be deleted.");

  const inUse = await prisma.userTenantMembership.count({ where: { roleId } });
  if (inUse > 0)
    throw Errors.conflict(
      `Role is in use by ${inUse} user(s) and cannot be deleted.`
    );

  // rolePermission rows have composite PK; cascading deletes are configured on relations,
  // but we can be explicit:
  await prisma.rolePermission.deleteMany({ where: { roleId } });
  const deleted = await prisma.role.delete({ where: { id: roleId } });

  return { hasDeletedRole: Boolean(deleted) };
}
