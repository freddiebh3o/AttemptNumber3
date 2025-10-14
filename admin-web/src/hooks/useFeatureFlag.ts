// admin-web/src/hooks/useFeatureFlag.ts
import { useAuthStore } from "../stores/auth";

/**
 * Hook to check if a feature flag is enabled for the current tenant
 * @param flagKey - The feature flag key (e.g., 'barcodeScanningEnabled')
 * @returns The value of the feature flag (defaults to false if not found)
 */
export function useFeatureFlag(flagKey: string): boolean {
  const featureFlags = useAuthStore((s) => s.currentTenant?.featureFlags ?? {});
  return featureFlags[flagKey] ?? false;
}

/**
 * Hook to get the value of a feature flag (not just boolean)
 * @param flagKey - The feature flag key (e.g., 'barcodeScanningMode')
 * @returns The value of the feature flag (defaults to null if not found)
 */
export function useFeatureFlagValue<T = any>(flagKey: string): T | null {
  const featureFlags = useAuthStore((s) => s.currentTenant?.featureFlags ?? {});
  return featureFlags[flagKey] ?? null;
}
