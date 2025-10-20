// api-server/src/types/tenant.ts

/**
 * Tenant feature flags stored in Tenant.featureFlags JSON column
 *
 * Example:
 * {
 *   barcodeScanningEnabled: true,
 *   chatAssistantEnabled: true,
 *   openaiApiKey: "sk-..."
 * }
 */
export interface TenantFeatureFlags {
  /** Enable/disable AI Chat Assistant feature for this tenant */
  chatAssistantEnabled?: boolean | undefined;

  /** Tenant-specific OpenAI API key (stored in plaintext in Phase 1, can encrypt in Phase 3) */
  openaiApiKey?: string | null | undefined;

  /** Enable/disable barcode scanning feature for this tenant */
  barcodeScanningEnabled?: boolean | undefined;

  /** Barcode scanning mode (camera, scanner, etc.) */
  barcodeScanningMode?: string | null | undefined;
}
