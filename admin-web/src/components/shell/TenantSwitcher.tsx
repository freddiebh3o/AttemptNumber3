/* admin-web/src/components/shell/TenantSwitcher.tsx */
import { useEffect, useMemo, useState } from 'react';
import { Select } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import { meApiRequest, switchTenantApiRequest } from '../../api/auth';
import { useAuthStore } from '../../stores/auth';

export default function TenantSwitcher() {
  const navigate = useNavigate();
  const { tenantSlug: slugFromUrl } = useParams();

  const setFromMe = useAuthStore((s) => s.setFromMe);
  const setCurrentTenantSlug = useAuthStore((s) => s.setCurrentTenantSlug);

  const [tenantSlugs, setTenantSlugs] = useState<string[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(slugFromUrl ?? null);

  useEffect(() => {
    (async () => {
      try {
        const me = await meApiRequest();
        // Save to global auth store
        setFromMe({
          currentUserId: me.data?.user.id,
          tenantMemberships: me.data?.tenantMemberships ?? [],
        });

        const slugs = (me.data?.tenantMemberships ?? []).map((m) => m.tenantSlug);
        setTenantSlugs(slugs);

        // Prefer URL slug; else first membership
        const initial = slugFromUrl || slugs[0] || null;
        setCurrentSlug(initial);
        setCurrentTenantSlug(initial);
      } catch {
        // Not signed in or not needed on sign-in page
      }
    })();
  }, [slugFromUrl, setFromMe, setCurrentTenantSlug]);

  const data = useMemo(
    () => tenantSlugs.map((slug) => ({ value: slug, label: slug })),
    [tenantSlugs]
  );

  async function handleChange(nextSlug: string | null) {
    if (!nextSlug || nextSlug === currentSlug) return;

    setCurrentSlug(nextSlug);
    setCurrentTenantSlug(nextSlug);
    try {
      await switchTenantApiRequest({ tenantSlug: nextSlug });
    } catch {
      // Non-fatal; server enforces on next call
    }
    navigate(`/${nextSlug}/products`);
  }

  return (
    <Select
      data={data}
      value={currentSlug}
      onChange={handleChange}
      placeholder="Select tenant"
      checkIconPosition="right"
      aria-label="Tenant switcher"
      w={220}
      searchable
      nothingFoundMessage={tenantSlugs.length ? 'No match' : 'No tenants'}
    />
  );
}