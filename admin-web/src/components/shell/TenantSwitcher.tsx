// admin-web/src/components/shell/TenantSwitcher.tsx
import { useEffect, useMemo } from "react";
import { Select } from "@mantine/core";
import { useNavigate, useParams } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";

export default function TenantSwitcher() {
  const navigate = useNavigate();
  const { tenantSlug: slugFromUrl } = useParams<{ tenantSlug: string }>();

  const {
    hydrated,
    tenantMemberships,
    currentTenantSlug,
    refreshFromServer,
    applySwitchTenant,
  } = useAuthStore();

  // Hydrate once from /me if not yet hydrated
  useEffect(() => {
    if (hydrated) return;
    void refreshFromServer();
  }, [hydrated, refreshFromServer]);

  // Keep server-side current tenant in sync with URL, or redirect to a valid slug
  useEffect(() => {
    if (!hydrated) return;

    const knownSlugs = tenantMemberships.map((m) => m.tenantSlug);
    const urlSlug = slugFromUrl ?? null;
    const serverSlug = currentTenantSlug;

    if (urlSlug && knownSlugs.includes(urlSlug)) {
      // If URL is valid but server's current tenant differs, switch on server
      if (serverSlug !== urlSlug) {
        void applySwitchTenant(urlSlug);
      }
      return;
    }

    // URL missing/invalid → choose a safe initial slug and navigate
    const initial =
      (serverSlug && knownSlugs.includes(serverSlug))
        ? serverSlug
        : knownSlugs[0] ?? null;

    if (initial && urlSlug !== initial) {
      navigate(`/${initial}/products`, { replace: true });
    }
  }, [hydrated, slugFromUrl, tenantMemberships, currentTenantSlug, applySwitchTenant, navigate]);

  const data = useMemo(
    () =>
      tenantMemberships.map((m) => ({
        value: m.tenantSlug,
        label: m.tenantSlug,
      })),
    [tenantMemberships]
  );

  async function handleChange(nextSlug: string | null) {
    if (!nextSlug) return;
    if (nextSlug === slugFromUrl) return;

    await applySwitchTenant(nextSlug);
    navigate(`/${nextSlug}/products`);
  }

  return (
    <Select
      data={data}
      value={slugFromUrl ?? currentTenantSlug ?? null}
      onChange={handleChange}
      placeholder="Select tenant"
      checkIconPosition="right"
      aria-label="Tenant switcher"
      w={220}
      searchable
      nothingFoundMessage={data.length ? "No match" : "No tenants"}
    />
  );
}
