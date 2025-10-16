// api-server/src/services/chat/tools/userTools.ts
import { tool } from 'ai';
import { z } from 'zod';
import * as tenantUserService from '../../tenantUsers/tenantUserService.js';
import * as roleService from '../../role/roleService.js';
import * as permissionService from '../../permissionService.js';
import { prismaClientInstance } from '../../../db/prismaClient.js';

/**
 * User and Role tools for AI chatbot
 *
 * SECURITY: All tools enforce:
 * - Tenant isolation (all queries filter by tenantId)
 * - Users and roles are tenant-scoped
 */
export function userTools({ userId, tenantId }: { userId: string; tenantId: string }) {
  return {
    searchUsers: tool({
      description: 'Search for users by email or name. Use when user asks "who are the users?" or "find user X". Returns users with their roles and branch assignments.',
      inputSchema: z.object({
        query: z.string().optional().describe('Email to search (partial match supported)'),
        roleId: z.string().optional().describe('Filter by role ID'),
        roleName: z.string().optional().describe('Filter by role name (e.g., "OWNER", "ADMIN")'),
        limit: z.number().optional().default(10).describe('Number of results (max 20)'),
      }),
      execute: async ({ query, roleId, roleName, limit }) => {
        try {
          const result = await tenantUserService.listUsersForCurrentTenantService({
            currentTenantId: tenantId,
            ...(query ? { qOptional: query } : {}),
            ...(roleId ? { roleIdOptional: roleId } : {}),
            ...(roleName ? { roleNameOptional: roleName } : {}),
            limitOptional: Math.min(limit || 10, 20),
            includeTotalOptional: true, // REQUIRED to get totalCount in pageInfo
          });

          if (result.items.length === 0) {
            return {
              users: [],
              count: 0,
              message: 'No users found matching criteria',
            };
          }

          return {
            users: result.items.map(u => ({
              userId: u.userId,
              email: u.userEmailAddress,
              role: u.role ? u.role.name : 'No role',
              permissions: u.role?.permissions || [],
              branches: u.branches.map(b => b.branchName),
              branchCount: u.branches.length,
              createdAt: u.createdAt,
            })),
            showing: result.items.length,
            totalCount: result.pageInfo.totalCount,
            hasMore: result.pageInfo.hasNextPage,
          };
        } catch (error: any) {
          return {
            error: 'Unable to search users',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    getUserDetails: tool({
      description: 'Get detailed information about a specific user including role, permissions, and branch assignments. Use when user asks "tell me about user X" or "what access does user Y have?"',
      inputSchema: z.object({
        userEmail: z.string().describe('User email address'),
      }),
      execute: async ({ userEmail }) => {
        try {
          // First, find the user by email
          const users = await tenantUserService.listUsersForCurrentTenantService({
            currentTenantId: tenantId,
            qOptional: userEmail,
            limitOptional: 1,
          });

          if (users.items.length === 0) {
            return {
              error: 'User not found',
              message: `No user found with email "${userEmail}" in this organization`,
            };
          }

          const user = users.items[0]!;

          return {
            userId: user.userId,
            email: user.userEmailAddress,
            role: user.role ? {
              name: user.role.name,
              description: user.role.description,
              isSystem: user.role.isSystem,
              permissions: user.role.permissions,
            } : null,
            branches: user.branches.map(b => ({
              id: b.id,
              name: b.branchName,
              isActive: b.isActive,
            })),
            memberSince: user.createdAt,
            lastUpdated: user.updatedAt,
          };
        } catch (error: any) {
          return {
            error: 'Unable to get user details',
            message: error.message || 'User not found or access denied',
          };
        }
      },
    }),

    listRoles: tool({
      description: 'List all roles in the organization with their permissions. Use when user asks "what roles do we have?" or "show me user roles".',
      inputSchema: z.object({
        includeSystem: z.boolean().optional().default(true)
          .describe('Include system roles (OWNER, ADMIN, EDITOR, VIEWER) - default: true'),
        limit: z.number().optional().default(10).describe('Number of roles to return (max 20)'),
      }),
      execute: async ({ includeSystem, limit }) => {
        try {
          const result = await roleService.listTenantRolesService({
            currentTenantId: tenantId,
            ...(includeSystem ? {} : { isSystemOptional: false }),
            limitOptional: Math.min(limit || 10, 20),
            sortByOptional: 'name',
            sortDirOptional: 'asc',
            includeTotalOptional: true, // REQUIRED to get totalCount in pageInfo
          });

          if (result.items.length === 0) {
            return {
              roles: [],
              count: 0,
              message: 'No roles found',
            };
          }

          // Get user counts per role
          const roleIds = result.items.map(r => r.id);
          const userCounts = await prismaClientInstance.userTenantMembership.groupBy({
            by: ['roleId'],
            where: {
              tenantId,
              roleId: { in: roleIds },
            },
            _count: { roleId: true },
          });

          const userCountMap = new Map(
            userCounts.map(c => [c.roleId, c._count.roleId])
          );

          return {
            roles: result.items.map(r => ({
              id: r.id,
              name: r.name,
              description: r.description || 'No description',
              isSystem: r.isSystem,
              permissions: r.permissions,
              permissionCount: r.permissions.length,
              userCount: userCountMap.get(r.id) || 0,
              createdAt: r.createdAt,
            })),
            showing: result.items.length,
            totalCount: result.pageInfo.totalCount,
            hasMore: result.pageInfo.hasNextPage,
          };
        } catch (error: any) {
          return {
            error: 'Unable to list roles',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),

    checkPermission: tool({
      description: 'Check if a user has a specific permission. Use when user asks "can user X do Y?" or "does user Z have permission to manage products?"',
      inputSchema: z.object({
        userEmail: z.string().describe('User email address'),
        permissionKey: z.string().describe('Permission key (e.g., "products:write", "users:manage", "stock:transfer")'),
      }),
      execute: async ({ userEmail, permissionKey }) => {
        try {
          // Find user by email
          const users = await tenantUserService.listUsersForCurrentTenantService({
            currentTenantId: tenantId,
            qOptional: userEmail,
            limitOptional: 1,
          });

          if (users.items.length === 0) {
            return {
              error: 'User not found',
              message: `No user found with email "${userEmail}"`,
            };
          }

          const user = users.items[0]!;

          // Get user's permissions using permission service
          const userPermissions = await permissionService.getPermissionKeysForUserInTenant({
            userId: user.userId,
            tenantId,
          });

          const hasPermission = userPermissions.has(permissionKey as any);

          return {
            user: user.userEmailAddress,
            permission: permissionKey,
            hasPermission,
            role: user.role?.name || 'No role',
            allPermissions: Array.from(userPermissions),
            explanation: hasPermission
              ? `Yes, ${user.userEmailAddress} has "${permissionKey}" permission via their ${user.role?.name} role`
              : `No, ${user.userEmailAddress} does not have "${permissionKey}" permission. They have ${userPermissions.size} total permissions via their ${user.role?.name} role`,
          };
        } catch (error: any) {
          return {
            error: 'Unable to check permission',
            message: error.message || 'An error occurred',
          };
        }
      },
    }),
  };
}
