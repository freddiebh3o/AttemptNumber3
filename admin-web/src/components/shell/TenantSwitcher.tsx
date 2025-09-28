/* admin-web/src/components/shell/TenantSwitcher.tsx */
import { useEffect, useMemo, useState } from 'react';
import { Select } from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import { meApiRequest, switchTenantApiRequest } from '../../api/auth'; // OpenAPI-typed helpers

export default function TenantSwitcher() {
  const navigate = useNavigate();
  const { tenantSlug: slugFromUrl } = useParams();

  const [tenantSlugs, setTenantSlugs] = useState<string[]>([]);
  const [currentSlug, setCurrentSlug] = useState<string | null>(slugFromUrl ?? null);

  useEffect(() => {
    (async () => {
      try {
        // Envelope: { success: true, data: { currentUserId, currentTenantId, tenantMemberships: [{ tenantSlug, roleName }] }, error: null }
        const me = await meApiRequest();
        const slugs = (me.data?.tenantMemberships ?? []).map((m) => m.tenantSlug);
        setTenantSlugs(slugs);

        // Prefer URL if present; else fall back to first membership (if any)
        if (slugFromUrl) {
          setCurrentSlug(slugFromUrl);
        } else if (slugs.length > 0) {
          setCurrentSlug(slugs[0]);
        } else {
          setCurrentSlug(null);
        }
      } catch {
        // Likely not signed in or on sign-in page; keep switcher inert
      }
    })();
  }, [slugFromUrl]);

  const data = useMemo(
    () => tenantSlugs.map((slug) => ({ value: slug, label: slug })), // no tenant name in /me response
    [tenantSlugs]
  );

  async function handleChange(nextSlug: string | null) {
    if (!nextSlug || nextSlug === currentSlug) return;

    setCurrentSlug(nextSlug);
    try {
      await switchTenantApiRequest({ tenantSlug: nextSlug });
    } catch {
      // Non-fatal; server will enforce on next API call
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
