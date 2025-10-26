// api-server/src/services/analytics/transferAnalyticsSerializer.ts
import { formatDateUK } from '../../utils/dateFormatter.js';

/**
 * Serialize volume chart data to British date format
 * Converts ISO date strings (yyyy-mm-dd) to dd/mm/yyyy
 */
export function serializeVolumeChartData(
  data: Array<{ date: string; created: number; approved: number; shipped: number; completed: number }>
) {
  return data.map((item) => ({
    ...item,
    date: formatDateUK(new Date(item.date)),
  }));
}
