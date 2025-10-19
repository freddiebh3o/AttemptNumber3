// admin-web/src/pages/RolePage.tsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Badge, Button, Group, Loader, Stack, Tabs, Text, Title, Paper, Modal } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconArchive, IconRestore } from "@tabler/icons-react";
import { useAuthStore } from "../stores/auth";
import { handlePageError } from "../utils/pageError";
import {
  createRoleApiRequest,
  updateRoleApiRequest,
  listPermissionsApiRequest,
  getRoleApiRequest,
  deleteRoleApiRequest,
  restoreRoleApiRequest,
  type PermissionRecord,
  type PermissionKey,
} from "../api/roles";
import { RoleActivityTab } from "../components/roles/RoleActivityTab";
import { RoleOverviewTab } from "../components/roles/RoleOverviewTab";

type TabKey = "overview" | "activity";

export default function RolePage() {
  const { tenantSlug, roleId } = useParams<{ tenantSlug: string; roleId?: string }>();
  // Treat /roles/new as "create" mode
  const isNew = !roleId || roleId === "new";
  const isEdit = !isNew;

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
  const [isArchived, setIsArchived] = useState(false);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Archive/restore state
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Trigger a refetch after successful updates
  const [refreshTick, setRefreshTick] = useState(0);

  // Load permissions catalogue (once)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listPermissionsApiRequest();
        if (!cancelled && res.success) {
          setPermOptions(res.data.permissions);
        }
      } catch {
        // non-fatal; the tab shows a nice "loading perms" label
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load role on edit (and whenever refreshTick changes)
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
          setIsArchived(r.isArchived ?? false);
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
    return () => {
      cancelled = true;
    };
  }, [isEdit, roleId, refreshTick]);

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
      if (isNew) {
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
          // Stay on this page and refresh the latest data
          setRefreshTick((t) => t + 1);
          return;
        }
      }
    } catch (e) {
      handlePageError(e, { title: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!roleId) return;

    setIsArchiving(true);
    try {
      const res = await deleteRoleApiRequest(roleId, `archive-${roleId}-${Date.now()}`);
      if (res.success) {
        notifications.show({ color: "green", message: "Role archived successfully" });
        setArchiveModalOpen(false);
        setRefreshTick((t) => t + 1); // Refresh to show archived state
      }
    } catch (e: any) {
      const msg =
        e?.details?.error?.errorCode === "CONFLICT"
          ? e?.details?.error?.userFacingMessage ?? "Cannot archive role with active memberships"
          : e?.message ?? "Archive failed";
      notifications.show({ color: "red", message: msg });
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleRestore() {
    if (!roleId) return;

    setIsRestoring(true);
    try {
      const res = await restoreRoleApiRequest(roleId, `restore-${roleId}-${Date.now()}`);
      if (res.success) {
        notifications.show({ color: "green", message: "Role restored successfully" });
        setRefreshTick((t) => t + 1); // Refresh to show active state
      }
    } catch (e: any) {
      notifications.show({
        color: "red",
        message: e?.message ?? "Restore failed",
      });
    } finally {
      setIsRestoring(false);
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
          {isEdit && isArchived && (
            <Badge color="red" size="lg" data-testid="archived-badge">
              Archived
            </Badge>
          )}
          {isEdit && isSystem && (
            <Badge color="gray" size="lg" data-testid="system-badge">
              System Role
            </Badge>
          )}
        </Group>
        <Group>
          {/* Archive button: only for active custom roles */}
          {isEdit && !isArchived && !isSystem && canManageRoles && (
            <Button
              variant="light"
              color="red"
              leftSection={<IconArchive size={16} />}
              onClick={() => setArchiveModalOpen(true)}
              data-testid="archive-role-btn"
            >
              Archive
            </Button>
          )}
          {/* Restore button: only for archived roles */}
          {isEdit && isArchived && canManageRoles && (
            <Button
              variant="light"
              color="green"
              leftSection={<IconRestore size={16} />}
              onClick={handleRestore}
              loading={isRestoring}
              data-testid="restore-role-btn"
            >
              Restore
            </Button>
          )}
          <Button variant="default" onClick={() => navigate(-1)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            loading={busy}
            disabled={!canManageRoles || (isEdit && isSystem) || (isEdit && isArchived)}
          >
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

      {/* Archive Confirmation Modal */}
      <Modal
        opened={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        title="Archive Role"
        centered
      >
        <Stack>
          <Text>
            Are you sure you want to archive this role? This role will be hidden from your active
            role list. Users with this role will need to be reassigned.
          </Text>
          <Text size="sm" c="dimmed">
            This action can be reversed by restoring the role.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setArchiveModalOpen(false)}>
              Cancel
            </Button>
            <Button color="red" onClick={handleArchive} loading={isArchiving}>
              Archive
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
