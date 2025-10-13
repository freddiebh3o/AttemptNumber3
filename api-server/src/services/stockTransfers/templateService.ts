// api-server/src/services/stockTransfers/templateService.ts
import { Prisma } from '@prisma/client';
import { prismaClientInstance } from '../../db/prismaClient.js';
import { Errors } from '../../utils/httpErrors.js';

type Ids = {
  currentTenantId: string;
  currentUserId: string;
};

/**
 * Create a new stock transfer template
 */
export async function createTransferTemplate(params: {
  tenantId: string;
  userId: string;
  data: {
    name: string;
    description?: string;
    sourceBranchId: string;
    destinationBranchId: string;
    items: Array<{
      productId: string;
      defaultQty: number;
    }>;
  };
}) {
  const { tenantId, userId, data } = params;

  // Validation: source and destination must be different
  if (data.sourceBranchId === data.destinationBranchId) {
    throw Errors.validation('Source and destination branches must be different');
  }

  // Validation: at least one item
  if (!data.items || data.items.length === 0) {
    throw Errors.validation('Template must include at least one item');
  }

  // Validation: name is required
  if (!data.name || data.name.trim() === '') {
    throw Errors.validation('Template name is required');
  }

  // Validate: both branches exist and belong to tenant
  const [sourceBranch, destinationBranch] = await Promise.all([
    prismaClientInstance.branch.findFirst({
      where: { id: data.sourceBranchId, tenantId, isActive: true },
      select: { id: true },
    }),
    prismaClientInstance.branch.findFirst({
      where: { id: data.destinationBranchId, tenantId, isActive: true },
      select: { id: true },
    }),
  ]);

  if (!sourceBranch) throw Errors.notFound('Source branch not found');
  if (!destinationBranch) throw Errors.notFound('Destination branch not found');

  // Validate: all products exist and belong to tenant
  const products = await prismaClientInstance.product.findMany({
    where: {
      id: { in: data.items.map((i) => i.productId) },
      tenantId,
    },
    select: { id: true },
  });

  if (products.length !== data.items.length) {
    throw Errors.validation('One or more products not found for this tenant');
  }

  // Create template
  const template = await prismaClientInstance.stockTransferTemplate.create({
    data: {
      tenantId,
      name: data.name.trim(),
      description: data.description?.trim() ?? null,
      sourceBranchId: data.sourceBranchId,
      destinationBranchId: data.destinationBranchId,
      createdByUserId: userId,
      items: {
        create: data.items.map((item) => ({
          productId: item.productId,
          defaultQty: item.defaultQty,
        })),
      },
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              productSku: true,
              productPricePence: true,
            },
          },
        },
      },
      sourceBranch: {
        select: { id: true, branchName: true, branchSlug: true },
      },
      destinationBranch: {
        select: { id: true, branchName: true, branchSlug: true },
      },
      createdByUser: {
        select: { id: true, userEmailAddress: true },
      },
    },
  });

  return template;
}

/**
 * List stock transfer templates for a tenant
 */
export async function listTransferTemplates(params: {
  tenantId: string;
  filters?: {
    q?: string; // Search by name or description
    sourceBranchId?: string;
    destinationBranchId?: string;
    limit?: number;
    cursor?: string;
  };
}) {
  const { tenantId, filters } = params;

  // Build where clause
  const where: Prisma.StockTransferTemplateWhereInput = {
    tenantId,
  };

  // Search by name or description
  if (filters?.q) {
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { description: { contains: filters.q, mode: 'insensitive' } },
    ];
  }

  // Filter by source branch
  if (filters?.sourceBranchId) {
    where.sourceBranchId = filters.sourceBranchId;
  }

  // Filter by destination branch
  if (filters?.destinationBranchId) {
    where.destinationBranchId = filters.destinationBranchId;
  }

  // Pagination
  const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 100);
  const take = limit + 1;

  const findArgs: Prisma.StockTransferTemplateFindManyArgs = {
    where,
    orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
    take,
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              productSku: true,
              productPricePence: true,
            },
          },
        },
      },
      sourceBranch: {
        select: { id: true, branchName: true, branchSlug: true },
      },
      destinationBranch: {
        select: { id: true, branchName: true, branchSlug: true },
      },
      createdByUser: {
        select: { id: true, userEmailAddress: true },
      },
    },
  };

  if (filters?.cursor) {
    findArgs.cursor = { id: filters.cursor };
    findArgs.skip = 1;
  }

  const rows = await prismaClientInstance.stockTransferTemplate.findMany(findArgs);

  const hasNextPage = rows.length > limit;
  const items = hasNextPage ? rows.slice(0, limit) : rows;
  const nextCursor = hasNextPage ? items[items.length - 1]?.id ?? null : null;

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor,
    },
  };
}

/**
 * Get single template with full details
 */
export async function getTransferTemplate(params: {
  tenantId: string;
  templateId: string;
}) {
  const { tenantId, templateId } = params;

  const template = await prismaClientInstance.stockTransferTemplate.findFirst({
    where: { id: templateId, tenantId },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              productSku: true,
              productPricePence: true,
            },
          },
        },
      },
      sourceBranch: {
        select: { id: true, branchName: true, branchSlug: true },
      },
      destinationBranch: {
        select: { id: true, branchName: true, branchSlug: true },
      },
      createdByUser: {
        select: { id: true, userEmailAddress: true },
      },
    },
  });

  if (!template) throw Errors.notFound('Template not found');

  return template;
}

/**
 * Update stock transfer template
 */
export async function updateTransferTemplate(params: {
  tenantId: string;
  templateId: string;
  data: {
    name?: string;
    description?: string;
    sourceBranchId?: string;
    destinationBranchId?: string;
    items?: Array<{
      productId: string;
      defaultQty: number;
    }>;
  };
}) {
  const { tenantId, templateId, data } = params;

  // Fetch existing template
  const existing = await prismaClientInstance.stockTransferTemplate.findFirst({
    where: { id: templateId, tenantId },
    select: {
      id: true,
      sourceBranchId: true,
      destinationBranchId: true,
    },
  });

  if (!existing) throw Errors.notFound('Template not found');

  // Determine final source and destination
  const finalSourceId = data.sourceBranchId ?? existing.sourceBranchId;
  const finalDestId = data.destinationBranchId ?? existing.destinationBranchId;

  // Validation: source and destination must be different
  if (finalSourceId === finalDestId) {
    throw Errors.validation('Source and destination branches must be different');
  }

  // If branches changed, validate they exist
  if (data.sourceBranchId || data.destinationBranchId) {
    const [sourceBranch, destinationBranch] = await Promise.all([
      prismaClientInstance.branch.findFirst({
        where: { id: finalSourceId, tenantId, isActive: true },
        select: { id: true },
      }),
      prismaClientInstance.branch.findFirst({
        where: { id: finalDestId, tenantId, isActive: true },
        select: { id: true },
      }),
    ]);

    if (!sourceBranch) throw Errors.notFound('Source branch not found');
    if (!destinationBranch) throw Errors.notFound('Destination branch not found');
  }

  // If items changed, validate products
  if (data.items) {
    if (data.items.length === 0) {
      throw Errors.validation('Template must include at least one item');
    }

    const products = await prismaClientInstance.product.findMany({
      where: {
        id: { in: data.items.map((i) => i.productId) },
        tenantId,
      },
      select: { id: true },
    });

    if (products.length !== data.items.length) {
      throw Errors.validation('One or more products not found for this tenant');
    }
  }

  // Update template in transaction
  const updated = await prismaClientInstance.$transaction(async (tx) => {
    // Update template fields
    const updateData: Prisma.StockTransferTemplateUpdateInput = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() ?? null;
    if (data.sourceBranchId) updateData.sourceBranchId = data.sourceBranchId;
    if (data.destinationBranchId) updateData.destinationBranchId = data.destinationBranchId;

    await tx.stockTransferTemplate.update({
      where: { id: templateId },
      data: updateData,
    });

    // If items changed, replace them
    if (data.items) {
      // Delete existing items
      await tx.stockTransferTemplateItem.deleteMany({
        where: { templateId },
      });

      // Create new items
      await tx.stockTransferTemplateItem.createMany({
        data: data.items.map((item) => ({
          templateId,
          productId: item.productId,
          defaultQty: item.defaultQty,
        })),
      });
    }

    // Fetch updated template with relations
    const result = await tx.stockTransferTemplate.findUnique({
      where: { id: templateId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                productName: true,
                productSku: true,
                productPricePence: true,
              },
            },
          },
        },
        sourceBranch: {
          select: { id: true, branchName: true, branchSlug: true },
        },
        destinationBranch: {
          select: { id: true, branchName: true, branchSlug: true },
        },
        createdByUser: {
          select: { id: true, userEmailAddress: true },
        },
      },
    });

    return result;
  });

  if (!updated) throw Errors.notFound('Template not found after update');

  return updated;
}

/**
 * Delete stock transfer template
 */
export async function deleteTransferTemplate(params: {
  tenantId: string;
  templateId: string;
}) {
  const { tenantId, templateId } = params;

  // Check if template exists
  const template = await prismaClientInstance.stockTransferTemplate.findFirst({
    where: { id: templateId, tenantId },
    select: { id: true },
  });

  if (!template) throw Errors.notFound('Template not found');

  // Delete template (cascade will delete items)
  await prismaClientInstance.stockTransferTemplate.delete({
    where: { id: templateId },
  });

  return { success: true };
}

/**
 * Duplicate stock transfer template
 */
export async function duplicateTransferTemplate(params: {
  tenantId: string;
  userId: string;
  templateId: string;
  newName?: string;
}) {
  const { tenantId, userId, templateId, newName } = params;

  // Get original template
  const original = await prismaClientInstance.stockTransferTemplate.findFirst({
    where: { id: templateId, tenantId },
    include: {
      items: true,
    },
  });

  if (!original) throw Errors.notFound('Template not found');

  // Create duplicate
  const duplicate = await prismaClientInstance.stockTransferTemplate.create({
    data: {
      tenantId,
      name: newName ?? `${original.name} (Copy)`,
      description: original.description,
      sourceBranchId: original.sourceBranchId,
      destinationBranchId: original.destinationBranchId,
      createdByUserId: userId,
      items: {
        create: original.items.map((item) => ({
          productId: item.productId,
          defaultQty: item.defaultQty,
        })),
      },
    },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              productName: true,
              productSku: true,
              productPricePence: true,
            },
          },
        },
      },
      sourceBranch: {
        select: { id: true, branchName: true, branchSlug: true },
      },
      destinationBranch: {
        select: { id: true, branchName: true, branchSlug: true },
      },
      createdByUser: {
        select: { id: true, userEmailAddress: true },
      },
    },
  });

  return duplicate;
}
