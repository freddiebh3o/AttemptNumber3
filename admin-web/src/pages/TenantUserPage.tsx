// admin-web/src/pages/TenantUserPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  PasswordInput,
  MultiSelect,
  Select,
  Modal,
  Alert,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import type { components } from "../types/openapi";
import {
  createTenantUserApiRequest,
  updateTenantUserApiRequest,
  getTenantUserApiRequest,
  deleteTenantUserApiRequest,
  restoreTenantUserApiRequest,
} from "../api/tenantUsers";
import { listRolesApiRequest } from "../api/roles";
import { listBranchesApiRequest } from "../api/branches";
import { handlePageError } from "../utils/pageError";
import { TenantUserActivityTab } from "../components/tenantUsers/TenantUserActivityTab";
import { IconArchive } from "@tabler/icons-react";
import { useAuthStore } from "../stores/auth";

type TenantUserRecord = components["schemas"]["TenantUserRecord"];
type RoleRecord = components["schemas"]["RoleRecord"];
type BranchRecord = components["schemas"]["BranchRecord"];

type CreateBody = NonNullable<
  import("../types/openapi").paths["/api/tenant-users"]["post"]["requestBody"]
>["content"]["application/json"];

type UpdateBody = NonNullable<
  import("../types/openapi").paths["/api/tenant-users/{userId}"]["put"]["requestBody"]
>["content"]["application/json"];

type TabKey = "overview" | "activity";

export default function TenantUserPage() {
  const { tenantSlug, userId } = useParams<{ tenantSlug: string; userId?: string }>();
  const isEdit = Boolean(userId);
  const navigate = useNavigate();
  const canManageUsers = useAuthStore((s) => s.hasPerm("users:manage"));
  const currentUserId = useAuthStore((s) => s.currentUserId);

  // tabs via URL
  const [searchParams, setSearchParams] = useSearchParams();
  const qpTab = (searchParams.get("tab") as TabKey | null) ?? "overview";
  const [activeTab, setActiveTab] = useState<TabKey>(qpTab);
  useEffect(() => {
    setActiveTab(qpTab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qpTab]);

  function setTabInUrl(tab: TabKey) {
    // Reset everything except the selected tab
    const next = new URLSearchParams();
    next.set("tab", tab);
    setSearchParams(next, { replace: false });
  }

  // catalogs
  const [roles, setRoles] = useState<RoleRecord[] | null>(null);
  const [loadingRoles, setLoadingRoles] = useState(true);

  const [branches, setBranches] = useState<BranchRecord[] | null>(null);
  const [loadingBranches, setLoadingBranches] = useState(true);

  // record for edit
  const [initial, setInitial] = useState<TenantUserRecord | null>(null);
  const [loadingUser, setLoadingUser] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);

  // form fields
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [isArchived, setIsArchived] = useState(false);

  const [saving, setSaving] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);

  // trigger refetch after successful update
  const [refreshTick, setRefreshTick] = useState(0);

  // load roles
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingRoles(true);
        const res = await listRolesApiRequest({ limit: 100, includeTotal: false });
        if (!cancelled && res.success) setRoles(res.data.items ?? []);
      } catch (e) {
        handlePageError(e, { title: "Failed to load roles" });
      } finally {
        if (!cancelled) setLoadingRoles(false);
      }
    })();
    return () => void (cancelled = true);
  }, []);

  // load branches
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingBranches(true);
        const res = await listBranchesApiRequest({
          limit: 100,
          includeTotal: false,
          sortBy: "branchName",
          sortDir: "asc",
        });
        if (!cancelled && res.success) setBranches(res.data.items ?? []);
      } catch (e) {
        handlePageError(e, { title: "Failed to load branches" });
      } finally {
        if (!cancelled) setLoadingBranches(false);
      }
    })();
    return () => void (cancelled = true);
  }, []);

  // fetch user on edit (and when refreshTick bumps)
  useEffect(() => {
    if (!isEdit || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        setNotFound(false);
        setLoadingUser(true);
        const res = await getTenantUserApiRequest({ userId });
        if (!cancelled && res.success) {
          const u = res.data.user as TenantUserRecord;
          setInitial(u);
          setEmail(u.userEmailAddress ?? "");
          setRoleId(u.role?.id ?? null);
          const existingBranchIds = (u as any).branches?.map((b: any) => b.id) ?? [];
          setBranchIds(existingBranchIds);
          setIsArchived(u.isArchived ?? false);
        }
      } catch (e: any) {
        if (!cancelled && (e?.httpStatusCode === 404 || e?.status === 404)) {
          setNotFound(true);
        } else {
          handlePageError(e, { title: "Failed to load user" });
        }
      } finally {
        if (!cancelled) setLoadingUser(false);
      }
    })();
    return () => void (cancelled = true);
  }, [isEdit, userId, refreshTick]);

  const roleChoices = useMemo(
    () => (roles ?? []).map((r) => ({ value: r.id, label: r.name })),
    [roles]
  );

  const branchChoices = useMemo(
    () =>
      (branches ?? []).map((b) => ({
        value: b.id,
        label: b.branchName + (b.isActive ? "" : " (inactive)"),
      })),
    [branches]
  );

  const pageTitle = isEdit ? "Edit user" : "New user";

  function setsEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    const sa = new Set(a);
    for (const x of b) if (!sa.has(x)) return false;
    return true;
  }

  async function handleSave() {
    if (!email.trim()) {
      notifications.show({ color: "red", message: "Email is required." });
      return;
    }
    if (!roleId) {
      notifications.show({ color: "red", message: "Role is required." });
      return;
    }
    if (!isEdit && password.length < 8) {
      notifications.show({ color: "red", message: "Password must be at least 8 characters." });
      return;
    }

    setSaving(true);
    try {
      const idk = (crypto as any)?.randomUUID?.() ?? Math.random().toString(36).slice(2);

      if (!isEdit) {
        const body: CreateBody = {
          email: email.trim(),
          password,
          roleId,
          branchIds,
        } as any;

        const res = await createTenantUserApiRequest({ ...body, idempotencyKeyOptional: idk });
        if (res.success) {
          notifications.show({ color: "green", message: "User created." });
          // Keep existing behavior for creates: go back to the users list.
          navigate(`/${tenantSlug}/users`);
        }
      } else {
        if (!userId) return;

        const initialBranchIds: string[] =
          ((initial as any)?.branches?.map((b: any) => b.id) as string[]) ?? [];
        const updateBody: UpdateBody = {
          ...(initial?.userEmailAddress !== email.trim() && { email: email.trim() }),
          ...(password ? { password } : {}),
          ...(initial?.role?.id !== roleId && roleId ? { roleId } : {}),
          ...(!setsEqual(initialBranchIds, branchIds) && { branchIds }),
        } as any;

        const res = await updateTenantUserApiRequest({
          userId,
          ...updateBody,
          idempotencyKeyOptional: idk,
        });
        if (res.success) {
          notifications.show({ color: "green", message: "User updated." });
          // Stay on page and refresh latest data
          setRefreshTick((t) => t + 1);
          // Clear password field after successful update to avoid confusion
          setPassword("");
        }
      }
    } catch (e) {
      handlePageError(e, { title: "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreUser() {
    if (!userId) return;
    setSaving(true);
    try {
      const key = (crypto as any)?.randomUUID?.() ?? String(Date.now());
      const res = await restoreTenantUserApiRequest({
        userId,
        idempotencyKeyOptional: key,
      });
      if (res.success) {
        notifications.show({ color: "green", message: "User restored." });
        setRefreshTick((t) => t + 1);
      }
    } catch (e) {
      handlePageError(e, { title: "Restore failed" });
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveUser() {
    if (!userId) return;
    setSaving(true);
    setShowArchiveModal(false);
    try {
      const key = (crypto as any)?.randomUUID?.() ?? String(Date.now());
      const res = await deleteTenantUserApiRequest({
        userId,
        idempotencyKeyOptional: key,
      });
      if (res.success) {
        notifications.show({ color: "green", message: "User archived successfully." });
        setRefreshTick((t) => t + 1);
      }
    } catch (e) {
      handlePageError(e, { title: "Archive failed" });
    } finally {
      setSaving(false);
    }
  }

  const isOwnMembership = userId === currentUserId;
  const busy = saving || loadingRoles || loadingBranches || (isEdit && loadingUser);

  // --- Not found (edit only) ---
  if (isEdit && notFound) {
    return (
      <Stack gap="lg">
        <Group justify="space-between" align="start">
          <Title order={2}>Edit user</Title>
          <Group>
            <Button variant="default" onClick={() => navigate(-1)}>
              Back
            </Button>
          </Group>
        </Group>

        <Paper withBorder radius="md" p="md" className="bg-white">
          <Title order={4} mb="xs">User not found</Title>
          <Text c="dimmed" mb="md">
            We couldn’t find a user with ID <code>{userId}</code>. It may have been deleted or you don’t have access.
          </Text>
          <Group>
            <Button variant="light" onClick={() => navigate(`/${tenantSlug}/users`)}>Go to users</Button>
            <Button onClick={() => navigate(`/${tenantSlug}/users/new`)}>Create a new user</Button>
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
          <Title order={2}>{pageTitle}</Title>
          {isEdit && isArchived && (
            <Badge color="gray" size="lg" data-testid="archived-badge">
              Archived
            </Badge>
          )}
        </Group>
        <Group>
          <Button variant="default" onClick={() => navigate(-1)}>Cancel</Button>
          {isEdit && isArchived && canManageUsers && (
            <Button
              onClick={handleRestoreUser}
              loading={busy}
              color="blue"
              data-testid="restore-btn"
            >
              Restore
            </Button>
          )}
          {isEdit && !isArchived && canManageUsers && !isOwnMembership && (
            <Button
              onClick={() => setShowArchiveModal(true)}
              variant="light"
              color="red"
              leftSection={<IconArchive size={16} />}
              data-testid="archive-user-btn"
            >
              Archive User
            </Button>
          )}
          {!isArchived && (
            <Button onClick={handleSave} loading={busy} disabled={!canManageUsers}>Save</Button>
          )}
        </Group>
      </Group>

      {busy && isEdit ? (
        <Group gap="sm">
          <Loader size="sm" />
          <Text>Loading…</Text>
        </Group>
      ) : (
        <>
          {/* Warning for archived users */}
          {isEdit && isArchived && (
            <Alert color="yellow" title="This user is archived" mb="md">
              This user membership has been archived and cannot sign in.
              All data is preserved and can be restored at any time.
            </Alert>
          )}
        </>
      )}

      {!(busy && isEdit) && (
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
            {isEdit && <Tabs.Tab value="activity">Activity</Tabs.Tab>}
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Paper withBorder radius="md" p="md" className="bg-white">
              <Stack gap="md">
                <TextInput
                  label="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                />
                <PasswordInput
                  label={isEdit ? "Reset password (optional)" : "Password"}
                  required={!isEdit}
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  placeholder={isEdit ? "Leave blank to keep existing password" : ""}
                />
                <Select
                  label="Role"
                  data={roleChoices}
                  value={roleId}
                  onChange={setRoleId}
                  searchable
                  nothingFoundMessage="No roles"
                  required
                />
                <MultiSelect
                  label="Branches"
                  description="Assign the user to one or more branches"
                  data={branchChoices}
                  value={branchIds}
                  onChange={setBranchIds}
                  searchable
                  nothingFoundMessage="No branches"
                  placeholder="Select branches…"
                  rightSectionWidth={90}
                  rightSection={
                    branchIds.length ? <Badge variant="light">{branchIds.length} selected</Badge> : null
                  }
                />
              </Stack>
            </Paper>
          </Tabs.Panel>

          {isEdit && userId && (
            <Tabs.Panel value="activity" pt="md">
              <TenantUserActivityTab userId={userId} />
            </Tabs.Panel>
          )}
        </Tabs>
      )}

      {/* Archive confirmation modal */}
      <Modal
        opened={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        title="Archive User?"
        centered
      >
        <Stack gap="md">
          <Text>
            This user membership will be deactivated and the user will not be able to sign in.
            All history and related data will be preserved and this membership can be restored at any time.
          </Text>
          {isOwnMembership && (
            <Alert color="red" title="Cannot archive own membership">
              You cannot archive your own user membership.
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button
              variant="default"
              onClick={() => setShowArchiveModal(false)}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleArchiveUser}
              loading={busy}
              disabled={isOwnMembership}
            >
              Archive
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
