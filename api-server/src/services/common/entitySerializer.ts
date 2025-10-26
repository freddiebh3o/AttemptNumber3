// api-server/src/services/common/entitySerializer.ts
import { formatDateTimeUK } from '../../utils/dateFormatter.js';

/**
 * Generic serializer for common entity timestamp fields
 * Converts Date objects to British format (dd/mm/yyyy HH:mm)
 *
 * This handles the standard Prisma timestamps that appear on most entities:
 * - createdAt
 * - updatedAt
 * - archivedAt
 */

/**
 * Serialize common timestamp fields for any entity
 * Handles createdAt, updatedAt, archivedAt
 */
export function serializeEntityTimestamps<T extends Record<string, any>>(entity: T): T {
  const serialized: any = { ...entity };

  if (entity.createdAt instanceof Date) {
    serialized.createdAt = formatDateTimeUK(entity.createdAt);
  }

  if (entity.updatedAt instanceof Date) {
    serialized.updatedAt = formatDateTimeUK(entity.updatedAt);
  }

  if (entity.archivedAt instanceof Date) {
    serialized.archivedAt = formatDateTimeUK(entity.archivedAt);
  } else if (entity.archivedAt === null) {
    serialized.archivedAt = null;
  }

  return serialized;
}

/**
 * Serialize nested entities recursively
 * Useful for responses with nested user, role, branch objects
 */
export function serializeNestedEntity<T extends Record<string, any>>(entity: T, nestedFields: string[] = []): T {
  let serialized: any = serializeEntityTimestamps(entity);

  // Recursively serialize specified nested objects
  for (const field of nestedFields) {
    if (serialized[field] && typeof serialized[field] === 'object') {
      if (Array.isArray(serialized[field])) {
        serialized[field] = serialized[field].map((item: any) => serializeEntityTimestamps(item));
      } else {
        serialized[field] = serializeEntityTimestamps(serialized[field]);
      }
    }
  }

  return serialized;
}

/**
 * Serialize activity log entries with occurredAt timestamps
 */
export function serializeActivityLog<T extends Record<string, any>>(log: T): T {
  const serialized: any = { ...log };

  if (log.occurredAt instanceof Date) {
    serialized.occurredAt = formatDateTimeUK(log.occurredAt);
  }

  // Also handle standard timestamps
  return serializeEntityTimestamps(serialized);
}
