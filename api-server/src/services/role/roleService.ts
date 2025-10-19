// api-server/src/services/roleService.ts
import { Prisma } from "@prisma/client";
import { prismaClientInstance as prisma } from "../../db/prismaClient.js";
import { Errors } from "../../utils/httpErrors.js";
import { writeAuditEvent } from "../auditLoggerService.js";
import { AuditAction, AuditEntityType } from "@prisma/client";

const dateAddDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * 24 * 60 * 60 * 1000);
const norm = (s: string) => s.trim();

type AuditCtx = {
  actorUserId?: string | null | undefined;
  correlationId?: string | null | undefined;
  ip?: string | null | undefined;
  userAgent?: string | null | undefined;
};

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
  archivedFilterOptional?: "active-only" | "archived-only" | "all";
  createdAtFromOptional?: string;
  createdAtToOptional?: string;
  updatedAtFromOptional?: string;
  updatedAtToOptional?: string;
  sortByOptional?: "name" | "createdAt" | "updatedAt" | "isSystem";
  sortDirOptional?: "asc" | "desc";
  includeTotalOptional?: boolean;
  permissionKeysOptional?: string[];
  permMatchOptional?: "any" | "all";
}) {
  // ... (unchanged)
  const {
    currentTenantId,
    limitOptional = 20,
    cursorIdOptional,
    qOptional,
    nameOptional,
    isSystemOptional,
    archivedFilterOptional = "active-only",
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
    // Archived filter
    ...(archivedFilterOptional === "active-only" && { isArchived: false }),
    ...(archivedFilterOptional === "archived-only" && { isArchived: true }),
    // "all" means no filter on isArchived
    ...((createdAt.gte || createdAt.lt) && { createdAt }),
    ...((updatedAt.gte || updatedAt.lt) && { updatedAt }),
  };

  if (permissionKeysOptional && permissionKeysOptional.length > 0) {
    const uniqueKeys = [...new Set(permissionKeysOptional)];
    if (permMatchOptional === "all") {
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
          { [sortByOptional]: sortDirOptional } as Prisma.RoleOrderByWithRelationInput,
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
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
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
    isArchived: r.isArchived,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    archivedByUserId: r.archivedByUserId ?? null,
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
        ...(isSystemOptional !== undefined ? { isSystem: isSystemOptional } : {}),
        ...(createdAtFromOptional ? { createdAtFrom: createdAtFromOptional } : {}),
        ...(createdAtToOptional ? { createdAtTo: createdAtToOptional } : {}),
        ...(updatedAtFromOptional ? { updatedAtFrom: updatedAtFromOptional } : {}),
        ...(updatedAtToOptional ? { updatedAtTo: updatedAtToOptional } : {}),
        ...(permissionKeysOptional && permissionKeysOptional.length
          ? { permissionKeys: permissionKeysOptional, permMatch: permMatchOptional }
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
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, name, description = null, permissionKeys, auditContextOptional } = params;
  const trimmedName = norm(name);

  const existing = await prisma.role.findUnique({
    where: { tenantId_name: { tenantId: currentTenantId, name: trimmedName } },
    select: { id: true },
  });
  if (existing) throw Errors.conflict("A role with this name already exists for this tenant.");

  const permIdByKey = await getPermissionIdMap();
  const ids: string[] = [];
  for (const key of permissionKeys) {
    const id = permIdByKey.get(key);
    if (!id) throw Errors.validation("Unknown permission key", `Invalid permission: ${key}`);
    ids.push(id);
  }

  return await prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: { tenantId: currentTenantId, name: trimmedName, description, isSystem: false },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        isSystem: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        createdAt: true,
        updatedAt: true
      },
    });

    if (ids.length) {
      await tx.rolePermission.createMany({
        data: ids.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }

    const after = {
      ...role,
      permissions: permissionKeys.sort(),
    };

    // AUDIT: CREATE (ROLE)
    await writeAuditEvent(tx, {
      tenantId: currentTenantId,
      actorUserId: auditContextOptional?.actorUserId ?? null,
      entityType: AuditEntityType.ROLE,
      entityId: role.id,
      action: AuditAction.CREATE,
      entityName: role.name,
      before: null,
      after,
      correlationId: auditContextOptional?.correlationId ?? null,
      ip: auditContextOptional?.ip ?? null,
      userAgent: auditContextOptional?.userAgent ?? null,
    });

    return {
      id: role.id,
      tenantId: role.tenantId ?? "",
      name: role.name,
      description: role.description ?? null,
      isSystem: role.isSystem,
      isArchived: role.isArchived,
      archivedAt: role.archivedAt?.toISOString() ?? null,
      archivedByUserId: role.archivedByUserId ?? null,
      permissions: permissionKeys.sort(),
      createdAt: role.createdAt.toISOString(),
      updatedAt: role.updatedAt.toISOString(),
    };
  });
}

export async function updateTenantRoleService(params: {
  currentTenantId: string;
  roleId: string;
  nameOptional?: string;
  descriptionOptional?: string | null;
  permissionKeysOptional?: string[];
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, roleId, auditContextOptional } = params;

  return await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        isSystem: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { permissionId: true, permission: { select: { key: true } } } },
      },
    });
    if (!role || role.tenantId !== currentTenantId)
      throw Errors.notFound("Role not found for this tenant.");
    if (role.isSystem) throw Errors.conflict("System roles cannot be modified.");
    if (role.isArchived) throw Errors.conflict("Archived roles cannot be modified. Please restore the role first.");

    const before = {
      id: role.id,
      tenantId: role.tenantId ?? "",
      name: role.name,
      description: role.description ?? null,
      isSystem: role.isSystem,
      isArchived: role.isArchived,
      archivedAt: role.archivedAt,
      archivedByUserId: role.archivedByUserId,
      permissions: role.permissions.map((p) => p.permission.key).sort(),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };

    // rename/description
    if (params.nameOptional !== undefined || params.descriptionOptional !== undefined) {
      const data: { name?: string; description?: string | null } = {};
      if (params.nameOptional !== undefined) {
        const newName = norm(params.nameOptional);
        if (newName !== role.name) {
          const dup = await tx.role.findUnique({
            where: { tenantId_name: { tenantId: currentTenantId, name: newName } },
            select: { id: true },
          });
          if (dup) throw Errors.conflict("A role with this name already exists for this tenant.");
        }
        data.name = newName;
      }
      if (params.descriptionOptional !== undefined) data.description = params.descriptionOptional;
      await tx.role.update({ where: { id: roleId }, data });
    }

    // permissions
    if (params.permissionKeysOptional !== undefined) {
      const permIdByKey = await getPermissionIdMap();
      const wantIds = new Set(
        params.permissionKeysOptional.map((k) => {
          const id = permIdByKey.get(k);
          if (!id) throw Errors.validation("Unknown permission key", `Invalid permission: ${k}`);
          return id;
        })
      );
      const haveIds = new Set(role.permissions.map((p) => p.permissionId));
      const toAdd = [...wantIds].filter((id) => !haveIds.has(id));
      const toRemove = [...haveIds].filter((id) => !wantIds.has(id));

      if (toAdd.length) {
        await tx.rolePermission.createMany({
          data: toAdd.map((permissionId) => ({ roleId, permissionId })),
          skipDuplicates: true,
        });
      }
      if (toRemove.length) {
        await tx.rolePermission.deleteMany({
          where: { roleId, permissionId: { in: toRemove } },
        });
      }
    }

    const fresh = await tx.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        isSystem: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (!fresh) throw Errors.internal("State mismatch after update.");

    const after = {
      id: fresh.id,
      tenantId: fresh.tenantId ?? "",
      name: fresh.name,
      description: fresh.description ?? null,
      isSystem: fresh.isSystem,
      isArchived: fresh.isArchived,
      archivedAt: fresh.archivedAt,
      archivedByUserId: fresh.archivedByUserId,
      permissions: fresh.permissions.map((p) => p.permission.key).sort(),
      createdAt: fresh.createdAt,
      updatedAt: fresh.updatedAt,
    };

    // AUDIT: UPDATE (ROLE)
    await writeAuditEvent(tx, {
      tenantId: currentTenantId,
      actorUserId: auditContextOptional?.actorUserId ?? null,
      entityType: AuditEntityType.ROLE,
      entityId: fresh.id,
      action: AuditAction.UPDATE,
      entityName: fresh.name,
      before,
      after,
      correlationId: auditContextOptional?.correlationId ?? null,
      ip: auditContextOptional?.ip ?? null,
      userAgent: auditContextOptional?.userAgent ?? null,
    });

    return {
      id: fresh.id,
      tenantId: fresh.tenantId ?? "",
      name: fresh.name,
      description: fresh.description ?? null,
      isSystem: fresh.isSystem,
      isArchived: fresh.isArchived,
      archivedAt: fresh.archivedAt?.toISOString() ?? null,
      archivedByUserId: fresh.archivedByUserId ?? null,
      permissions: after.permissions,
      createdAt: fresh.createdAt.toISOString(),
      updatedAt: fresh.updatedAt.toISOString(),
    };
  });
}

export async function deleteTenantRoleService(params: {
  currentTenantId: string;
  roleId: string;
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, roleId, auditContextOptional } = params;

  return await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        isSystem: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    if (!role || role.tenantId !== currentTenantId)
      throw Errors.notFound("Role not found for this tenant.");
    if (role.isSystem) throw Errors.conflict("System roles cannot be archived.");
    if (role.isArchived) throw Errors.conflict("Role is already archived.");

    const inUse = await tx.userTenantMembership.count({ where: { roleId } });
    if (inUse > 0) {
      throw Errors.conflict(`Role is in use by ${inUse} user(s) and cannot be archived.`);
    }

    const before = {
      id: role.id,
      tenantId: role.tenantId ?? "",
      name: role.name,
      description: role.description ?? null,
      isSystem: role.isSystem,
      isArchived: role.isArchived,
      archivedAt: role.archivedAt,
      archivedByUserId: role.archivedByUserId,
      permissions: role.permissions.map((p) => p.permission.key).sort(),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };

    // Archive the role instead of deleting
    const archived = await tx.role.update({
      where: { id: roleId },
      data: {
        isArchived: true,
        archivedAt: new Date(),
        archivedByUserId: auditContextOptional?.actorUserId ?? null,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        isSystem: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });

    const after = {
      id: archived.id,
      tenantId: archived.tenantId ?? "",
      name: archived.name,
      description: archived.description ?? null,
      isSystem: archived.isSystem,
      isArchived: archived.isArchived,
      archivedAt: archived.archivedAt,
      archivedByUserId: archived.archivedByUserId,
      permissions: archived.permissions.map((p) => p.permission.key).sort(),
      createdAt: archived.createdAt,
      updatedAt: archived.updatedAt,
    };

    // AUDIT: UPDATE (ROLE) - archival is an update, not delete
    await writeAuditEvent(tx, {
      tenantId: currentTenantId,
      actorUserId: auditContextOptional?.actorUserId ?? null,
      entityType: AuditEntityType.ROLE,
      entityId: role.id,
      action: AuditAction.UPDATE,
      entityName: role.name,
      before,
      after,
      correlationId: auditContextOptional?.correlationId ?? null,
      ip: auditContextOptional?.ip ?? null,
      userAgent: auditContextOptional?.userAgent ?? null,
    });

    return {
      id: archived.id,
      tenantId: archived.tenantId ?? "",
      name: archived.name,
      description: archived.description ?? null,
      isSystem: archived.isSystem,
      isArchived: archived.isArchived,
      archivedAt: archived.archivedAt?.toISOString() ?? null,
      archivedByUserId: archived.archivedByUserId ?? null,
      permissions: archived.permissions.map((p) => p.permission.key).sort(),
      createdAt: archived.createdAt.toISOString(),
      updatedAt: archived.updatedAt.toISOString(),
    };
  });
}

export async function getTenantRoleService(params: {
  currentTenantId: string;
  roleId: string;
}) {
  const { currentTenantId, roleId } = params;

  const r = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      id: true,
      tenantId: true,
      name: true,
      description: true,
      isSystem: true,
      isArchived: true,
      archivedAt: true,
      archivedByUserId: true,
      createdAt: true,
      updatedAt: true,
      permissions: { select: { permission: { select: { key: true } } } },
    },
  });

  if (!r || r.tenantId !== currentTenantId) {
    throw Errors.notFound("Role not found for this tenant.");
  }

  return {
    id: r.id,
    tenantId: r.tenantId ?? "",
    name: r.name,
    description: r.description ?? null,
    isSystem: r.isSystem,
    isArchived: r.isArchived,
    archivedAt: r.archivedAt?.toISOString() ?? null,
    archivedByUserId: r.archivedByUserId ?? null,
    permissions: r.permissions.map((p) => p.permission.key).sort(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export async function restoreTenantRoleService(params: {
  currentTenantId: string;
  roleId: string;
  auditContextOptional?: AuditCtx;
}) {
  const { currentTenantId, roleId, auditContextOptional } = params;

  return await prisma.$transaction(async (tx) => {
    const role = await tx.role.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        isSystem: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });

    if (!role || role.tenantId !== currentTenantId) {
      throw Errors.notFound("Role not found for this tenant.");
    }
    if (!role.isArchived) {
      throw Errors.conflict("Role is not archived.");
    }

    const before = {
      id: role.id,
      tenantId: role.tenantId ?? "",
      name: role.name,
      description: role.description ?? null,
      isSystem: role.isSystem,
      isArchived: role.isArchived,
      archivedAt: role.archivedAt,
      archivedByUserId: role.archivedByUserId,
      permissions: role.permissions.map((p) => p.permission.key).sort(),
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };

    // Restore the role
    const restored = await tx.role.update({
      where: { id: roleId },
      data: {
        isArchived: false,
        archivedAt: null,
        archivedByUserId: null,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        description: true,
        isSystem: true,
        isArchived: true,
        archivedAt: true,
        archivedByUserId: true,
        createdAt: true,
        updatedAt: true,
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });

    const after = {
      id: restored.id,
      tenantId: restored.tenantId ?? "",
      name: restored.name,
      description: restored.description ?? null,
      isSystem: restored.isSystem,
      isArchived: restored.isArchived,
      archivedAt: restored.archivedAt,
      archivedByUserId: restored.archivedByUserId,
      permissions: restored.permissions.map((p) => p.permission.key).sort(),
      createdAt: restored.createdAt,
      updatedAt: restored.updatedAt,
    };

    // AUDIT: UPDATE (ROLE) - restore is an update
    await writeAuditEvent(tx, {
      tenantId: currentTenantId,
      actorUserId: auditContextOptional?.actorUserId ?? null,
      entityType: AuditEntityType.ROLE,
      entityId: role.id,
      action: AuditAction.UPDATE,
      entityName: role.name,
      before,
      after,
      correlationId: auditContextOptional?.correlationId ?? null,
      ip: auditContextOptional?.ip ?? null,
      userAgent: auditContextOptional?.userAgent ?? null,
    });

    return {
      id: restored.id,
      tenantId: restored.tenantId ?? "",
      name: restored.name,
      description: restored.description ?? null,
      isSystem: restored.isSystem,
      isArchived: restored.isArchived,
      archivedAt: restored.archivedAt?.toISOString() ?? null,
      archivedByUserId: restored.archivedByUserId ?? null,
      permissions: restored.permissions.map((p) => p.permission.key).sort(),
      createdAt: restored.createdAt.toISOString(),
      updatedAt: restored.updatedAt.toISOString(),
    };
  });
}