// api-server/src/services/chat/suggestionService.ts
import { prismaClientInstance } from '../../db/prismaClient.js';
import { getPermissionKeysForUserInTenant } from '../permissionService.js';

/**
 * Smart suggestion service for AI chatbot
 *
 * Generates contextual suggestions based on:
 * - User's permissions
 * - User's branch memberships
 * - Recent platform activity
 * - Common use cases
 */

export interface ChatSuggestion {
  id: string;
  text: string;
  category: 'products' | 'stock' | 'transfers' | 'analytics' | 'users' | 'general';
  icon?: string;
}

/**
 * Generate smart suggestions for a user
 */
export async function getSuggestionsForUser({
  userId,
  tenantId,
  limit = 6,
}: {
  userId: string;
  tenantId: string;
  limit?: number;
}): Promise<ChatSuggestion[]> {
  const suggestions: ChatSuggestion[] = [];

  // Get user's permissions
  const permissions = await getPermissionKeysForUserInTenant({ userId, tenantId });

  // Get user's branch memberships
  const branchMemberships = await prismaClientInstance.userBranchMembership.findMany({
    where: { userId, tenantId },
    include: { branch: { select: { branchName: true } } },
    take: 3,
  });

  // Get user info for role-based suggestions
  const membership = await prismaClientInstance.userTenantMembership.findFirst({
    where: { userId, tenantId },
    include: { role: { select: { name: true } } },
  });

  const isOwnerOrAdmin = membership?.role.name === 'OWNER' || membership?.role.name === 'ADMIN';

  // 1. Product suggestions (if user has products:read)
  if (permissions.has('products:read')) {
    suggestions.push({
      id: 'count-products',
      text: 'How many products do we have?',
      category: 'products',
      icon: 'IconPackage',
    });

    // If user has write access, suggest creating
    if (permissions.has('products:write')) {
      suggestions.push({
        id: 'search-products',
        text: 'Show me all products',
        category: 'products',
        icon: 'IconSearch',
      });
    }
  }

  // 2. Stock suggestions (if user has stock:read and branches)
  if (permissions.has('stock:read') && branchMemberships.length > 0) {
    const firstBranch = branchMemberships[0]!.branch.branchName;

    suggestions.push({
      id: 'stock-at-branch',
      text: `What's in stock at ${firstBranch}?`,
      category: 'stock',
      icon: 'IconPackageExport',
    });

    suggestions.push({
      id: 'low-stock',
      text: 'Show me products with low stock',
      category: 'stock',
      icon: 'IconAlertTriangle',
    });

    // Recent stock movements
    suggestions.push({
      id: 'recent-movements',
      text: 'Show me recent stock movements',
      category: 'stock',
      icon: 'IconHistory',
    });
  }

  // 3. Transfer suggestions (if user has stock:read and branches)
  if (permissions.has('stock:read') && branchMemberships.length > 0) {
    suggestions.push({
      id: 'pending-transfers',
      text: 'Show my pending transfers',
      category: 'transfers',
      icon: 'IconTruckDelivery',
    });

    suggestions.push({
      id: 'recent-transfers',
      text: 'What are my recent transfers?',
      category: 'transfers',
      icon: 'IconClipboardList',
    });

    // If user has write access, suggest creating
    if (permissions.has('stock:write')) {
      suggestions.push({
        id: 'urgent-transfers',
        text: 'Show urgent transfers',
        category: 'transfers',
        icon: 'IconAlertCircle',
      });
    }
  }

  // 4. Analytics suggestions (if user has reports:view)
  if (permissions.has('reports:view')) {
    suggestions.push({
      id: 'transfer-metrics',
      text: 'Show me transfer metrics for last 30 days',
      category: 'analytics',
      icon: 'IconChartBar',
    });

    if (branchMemberships.length > 0) {
      const firstBranch = branchMemberships[0]!.branch.branchName;
      suggestions.push({
        id: 'branch-performance',
        text: `How is ${firstBranch} performing?`,
        category: 'analytics',
        icon: 'IconTrendingUp',
      });
    }

    suggestions.push({
      id: 'stock-value',
      text: 'What is our total stock value?',
      category: 'analytics',
      icon: 'IconCoin',
    });
  }

  // 5. User management suggestions (if admin/owner)
  if (isOwnerOrAdmin && permissions.has('users:manage')) {
    suggestions.push({
      id: 'list-users',
      text: 'Who are the users in our system?',
      category: 'users',
      icon: 'IconUsers',
    });

    suggestions.push({
      id: 'list-roles',
      text: 'What roles do we have?',
      category: 'users',
      icon: 'IconShield',
    });
  }

  // 6. General help suggestions (always available)
  suggestions.push({
    id: 'help',
    text: 'What can you help me with?',
    category: 'general',
    icon: 'IconHelp',
  });

  // 7. Branch-specific suggestions
  if (branchMemberships.length > 1) {
    suggestions.push({
      id: 'list-branches',
      text: 'Show me all branches',
      category: 'general',
      icon: 'IconBuilding',
    });
  }

  // Shuffle and limit to requested number
  // Prioritize based on category order: transfers, stock, products, analytics, users, general
  const categoryPriority = ['transfers', 'stock', 'products', 'analytics', 'users', 'general'];

  const sortedSuggestions = suggestions.sort((a, b) => {
    const aPriority = categoryPriority.indexOf(a.category);
    const bPriority = categoryPriority.indexOf(b.category);
    return aPriority - bPriority;
  });

  return sortedSuggestions.slice(0, limit);
}

/**
 * Get category-specific suggestions
 */
export async function getSuggestionsByCategory({
  userId,
  tenantId,
  category,
  limit = 4,
}: {
  userId: string;
  tenantId: string;
  category: ChatSuggestion['category'];
  limit?: number;
}): Promise<ChatSuggestion[]> {
  const allSuggestions = await getSuggestionsForUser({ userId, tenantId, limit: 50 });
  return allSuggestions.filter(s => s.category === category).slice(0, limit);
}
