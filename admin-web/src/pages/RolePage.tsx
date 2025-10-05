// admin-web/src/pages/RolePage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge, Button, Group, Loader, Stack, Tabs, Text, Title, Paper } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useAuthStore } from "../stores/auth";
import { handlePageError } from "../utils/pageError";
import {
  createRoleApiRequest,
  updateRoleApiRequest,
  listPermissionsApiRequest,
  getRoleApiRequest,
  type PermissionRecord,
  type PermissionKey,
} from "../api/roles";
import { RoleActivityTab } from "../components/roles/RoleActivityTab";
import { RoleOverviewTab } from "../components/roles/RoleOverviewTab";

type TabKey = "overview" | "activity";

export default function RolePage() {
  const { tenantSlug, roleId } = useParams<{ tenantSlug: string; roleId?: string }>();
  const isEdit = Boolean(roleId);
  const navigate = useNavigate();
  const canManageRoles = useAuthStore((s) => s.hasPerm("roles:manage"));

  // URL tab state
  const [searchParams, setSearchParams] = useSearchParams();
  const qpTab = (searchParams.get("tab") as TabKey | null) ?? "overview";
  const [activeTab, setActiveTab] = useState<TabKey>(qpTab);

  useEffect(() => {
    setActiveTab(qpTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qpTab]);

  function setTabInUrl(tab: TabKey) {
    const next = new URLSearchParams();
    next.set("tab", tab);
    setSearchParams(next, { replace: false });
  }

  // ---- Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState<string | null>("");
  const [permOptions, setPermOptions] = useState<PermissionRecord[]>([]);
  const [selectedPerms, setSelectedPerms] = useState<PermissionKey[]>([]);
  const [isSystem, setIsSystem] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Load permissions catalogue (once)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listPermissionsApiRequest();
        if (!cancelled && res.success) {
          setPermOptions(res.data.permissions);
        }
      } catch (e) {
        // non-fatal; the tab shows a nice "loading perms" label
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load role on edit
  useEffect(() => {
    if (!isEdit || !roleId) return;
    let cancelled = false;
    (async () => {
      try {
        setNotFound(false);
        setLoading(true);
        const res = await getRoleApiRequest(roleId);
        if (!cancelled && res.success) {
          const r = res.data.role;
          setName(r.name);
          setDescription(r.description ?? "");
          setSelectedPerms(r.permissions as PermissionKey[]);
          setIsSystem(r.isSystem);
        }
      } catch (e: any) {
        if (!cancelled && (e?.httpStatusCode === 404 || e?.status === 404)) {
          setNotFound(true);
        } else {
          handlePageError(e, { title: "Failed to load role" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isEdit, roleId]);

  async function handleSave() {
    if (!name.trim()) {
      notifications.show({ color: "red", message: "Name is required" });
      return;
    }
    if (isEdit && isSystem) {
      notifications.show({ color: "red", message: "System roles cannot be edited" });
      return;
    }
    setSaving(true);
    try {
      const idempotencyKey = (crypto as any)?.randomUUID?.() ?? String(Date.now());
      if (!isEdit) {
        const res = await createRoleApiRequest(
          {
            name: name.trim(),
            description: (description ?? "").trim() || null,
            permissionKeys: selectedPerms,
          },
          idempotencyKey
        );
        if (res.success) {
          notifications.show({ color: "green", message: "Role created." });
          const newId = res.data.role.id;
          navigate(`/${tenantSlug}/roles/${newId}?tab=overview`, { replace: true });
          return;
        }
      } else {
        if (!roleId) return;
        const res = await updateRoleApiRequest(
          roleId,
          {
            ...(name.trim() ? { name: name.trim() } : {}),
            description: (description ?? "").trim() || null,
            permissionKeys: selectedPerms,
          },
          idempotencyKey
        );
        if (res.success) {
          notifications.show({ color: "green", message: "Role updated." });
          navigate(`/${tenantSlug}/roles`);
        }
      }
    } catch (e) {
      handlePageError(e, { title: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || loading;

  // --- Not found (edit mode) ---
  if (isEdit && notFound) {
    return (
      <Stack gap="lg">
        <Group justify="space-between" align="start">
          <Title order={2}>Edit role</Title>
          <Group>
            <Button variant="default" onClick={() => navigate(-1)}>
              Back
            </Button>
          </Group>
        </Group>

        <Paper withBorder radius="md" p="md" className="bg-white">
          <Title order={4} mb="xs">Role not found</Title>
          <Text c="dimmed" mb="md">
            We couldn’t find a role with ID <code>{roleId}</code>. It may have been deleted or you don’t have access.
          </Text>
          <Group>
            <Button variant="light" onClick={() => navigate(`/${tenantSlug}/roles`)}>
              Go to roles
            </Button>
            <Button onClick={() => navigate(`/${tenantSlug}/roles/new`)}>
              Create a new role
            </Button>
          </Group>
        </Paper>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" align="start">
        <Group gap="sm">
          <Title order={2}>{isEdit ? "Edit role" : "New role"}</Title>
          {isEdit && isSystem && <Badge color="gray">System</Badge>}
        </Group>
        <Group>
          <Button variant="default" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={busy} disabled={!canManageRoles || (isEdit && isSystem)}>
            Save
          </Button>
        </Group>
      </Group>

      {busy && isEdit ? (
        <Group gap="sm">
          <Loader size="sm" />
          <Text>Loading…</Text>
        </Group>
      ) : (
        <Tabs
          value={activeTab}
          onChange={(v) => {
            const next = (v as TabKey) ?? "overview";
            setActiveTab(next);
            setTabInUrl(next);
          }}
          keepMounted={false}
        >
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            {isEdit && roleId && <Tabs.Tab value="activity">Activity</Tabs.Tab>}
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <RoleOverviewTab
              isEdit={isEdit}
              isSystem={isSystem}
              name={name}
              description={description ?? ""}
              allPermissions={permOptions}
              selectedPermissions={selectedPerms}
              onChangeName={setName}
              onChangeDescription={setDescription}
              onChangeSelected={(keys) => setSelectedPerms(keys)}
            />
          </Tabs.Panel>

          {isEdit && roleId && (
            <Tabs.Panel value="activity" pt="md">
              <RoleActivityTab roleId={roleId} />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
    </Stack>
  );
}
