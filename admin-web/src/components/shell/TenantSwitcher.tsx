/* admin-web/src/components/shell/TenantSwitcher.tsx */
import { useEffect, useMemo } from 'react';
import { Select } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import { meApiRequest, switchTenantApiRequest } from '../../api/auth';
import { useAuthStore } from '../../stores/auth';

export default function TenantSwitcher() {
  const navigate = useNavigate();
  const { tenantSlug: slugFromUrl } = useParams();

  const {
    hydrated,
    tenantMemberships,
    currentTenantSlug,
    setFromMe,
    setCurrentTenantSlug,
  } = useAuthStore();

  // Hydrate once from /me if not yet hydrated
  useEffect(() => {
    (async () => {
      if (hydrated) return;
      try {
        const me = await meApiRequest();
        console.log('me', me);
        setFromMe({
          user: me.data.user,
          tenantMemberships: me.data.tenantMemberships ?? [],
          currentTenant: me.data.currentTenant ?? null,
        });
      } catch {
      }
    })();
  }, [hydrated, setFromMe]);

  useEffect(() => {
    if (!hydrated) return;
    const knownSlugs = tenantMemberships.map((m) => m.tenantSlug);
    const initial =
      (slugFromUrl && knownSlugs.includes(slugFromUrl))
        ? slugFromUrl
        : (currentTenantSlug && knownSlugs.includes(currentTenantSlug))
          ? currentTenantSlug
          : knownSlugs[0] ?? null;

    if (initial !== currentTenantSlug) {
      setCurrentTenantSlug(initial);
    }
  }, [hydrated, slugFromUrl, tenantMemberships]);

  const data = useMemo(
    () => tenantMemberships.map((m) => ({ value: m.tenantSlug, label: m.tenantSlug })),
    [tenantMemberships]
  );

  async function handleChange(nextSlug: string | null) {
    if (!nextSlug || nextSlug === currentTenantSlug) return;

    setCurrentTenantSlug(nextSlug);

    try {
      await switchTenantApiRequest({ tenantSlug: nextSlug });
      const me = await meApiRequest();
      setFromMe({ user: me.data.user, tenantMemberships: me.data.tenantMemberships ?? [], currentTenant: me.data.currentTenant ?? null });
    } catch {
    }
    navigate(`/${nextSlug}/products`);
  }

  return (
    <Select
      data={data}
      value={currentTenantSlug}
      onChange={handleChange}
      placeholder="Select tenant"
      checkIconPosition="right"
      aria-label="Tenant switcher"
      w={220}
      searchable
      nothingFoundMessage={data.length ? 'No match' : 'No tenants'}
    />
  );
}
